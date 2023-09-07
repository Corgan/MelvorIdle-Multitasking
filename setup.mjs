export async function setup({ loadTemplates, gameData, loadModule, loadScript, onInterfaceAvailable, onModsLoaded, onCharacterLoaded, onInterfaceReady, patch }) {
  await loadTemplates("templates.html"); // Add templates
  
  const { Multitasking } = await loadModule('src/multitasking.mjs');

  let multitasking = new Multitasking(game.registeredNamespaces.getNamespace('multitasking'), 'multitasking', game);

  game.multitasking = multitasking;
  game.actions.registerObject(multitasking);
  game.activeActions.registerObject(multitasking);

  await gameData.addPackage('data.json'); // Add skill data (page + sidebar, skillData)

  onModsLoaded(() => {
    patch(Thieving, 'resetActionState').replace(function(o) {
      if(this.isActive && !multitasking.actions.has(this))
        o();
    });

    patch(Game, 'idleChecker').replace(function(o, skill) {
      if (this.activeAction === multitasking) {
          return false;
      }
      return o(skill);
    });

    patch(Game, 'clearActiveAction').replace(function(o, save=true) {
      if (!this.disableClearOffline) {
          this.activeAction = multitasking;
          if (save)
              this.scheduleSave();
          deleteScheduledPushNotification('offlineSkill');
      }
    });

    let patchedRenderGameTitle = patch(Game, 'renderGameTitle');
    let shouldRenderGameTitle = false;
    patchedRenderGameTitle.before(function() {
      shouldRenderGameTitle = this.renderQueue.title;
    });
    patchedRenderGameTitle.after(function() {
      if(shouldRenderGameTitle) {
        if(this.activeAction === multitasking && (multitasking.actions.has(this.combat) || multitasking.actions.has(this.thieving))){
          $('title').text(`${getLangString('SKILL_NAME_Hitpoints')} ${numberWithCommas(this.combat.player.hitpoints)}`);
        }
        shouldRenderGameTitle = false
      }
    });

    let patchedRenderCombatMinibar = patch(Game, 'renderCombatMinibar');
    let shouldRenderCombatMinibar = false;
    patchedRenderCombatMinibar.before(function() {
      shouldRenderCombatMinibar = this.renderQueue.combatMinibar;
    });

    patchedRenderCombatMinibar.after(function() {
      if(shouldRenderCombatMinibar) {
        const minibar = document.getElementById('combat-footer-minibar');
        if(this.activeAction === multitasking && (multitasking.actions.has(this.combat))) {
          showElement(minibar);
        } else {
          hideElement(minibar);
        }
      }
    });

    patch(BaseManager, 'checkDeath').before(function() {
      const playerDied = this.player.hitpoints <= 0;
      if(playerDied && multitasking.actions.has(this.game.thieving))
        this.game.thieving.stopOnDeath();
    });

    patch(CombatManager, 'onSelection').after(function() {
      multitasking.addAction(this);
      this.game.activeAction = multitasking;
    });

    patch(CombatManager, 'stop').after(function(stopped) {
      if(stopped)
        multitasking.removeAction(this);
      return stopped;
    });

    game.activeActions.forEach(action => {
      if(action instanceof Skill) {
        if(action.start !== undefined) {
          patch(action.constructor, 'start').after(function(started) {
            if(started) {
              multitasking.addAction(this);
              this.game.activeAction = multitasking;
            }
            return started;
          });
        } else {
          if(Cartography !== undefined && action.constructor === Cartography) {
            let startActions = ['startAutoSurvey', 'startSurveyQueue', 'startMakingPaper', 'startUpgradingMap'];
            startActions.forEach(startAction => {
              patch(action.constructor, startAction).after(function(started) {
                if(started) {
                  multitasking.addAction(this);
                  this.game.activeAction = multitasking;
                }
                return started;
              });
            })
            }
        }
      
        patch(action.constructor, 'stop').after(function(stopped) {
          if(stopped)
            multitasking.removeAction(this);
          return stopped;
        });
      }
    });

    patch(RaidManager, 'preStartRaid').replace(function() {
      return;
    });

    patch(Game, 'onLoad').before(function() {
      this.activeActions.forEach(action => {
        if(action.isActive && action !== multitasking)
          multitasking.addAction(action);
      });
    });
  });
}