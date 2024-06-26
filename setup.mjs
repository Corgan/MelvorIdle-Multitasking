export async function setup({ namespace, loadTemplates, gameData, loadModule, loadScript, onInterfaceAvailable, onModsLoaded, onCharacterLoaded, onInterfaceReady, patch, settings }) {
  await loadTemplates("templates.html"); // Add templates

  const { MultitaskingActionGroupElement } = await loadModule('src/components/multitasking-action-group.mjs');
  const { MultitaskingActionElement } = await loadModule('src/components/multitasking-action.mjs');

  settings.type('action-groups', {
    render: function(name, onChange, config) {
      const root = document.createElement('div');
      root.id = name;
    
      return root;
    },
    get: function(root) {
      console.log('get', root);
      let groups = {};
      groups.default = [];
      groups.test = [];
      return groups;
    },
    set: function(root, data) {
      const actions = game.multitasking.validActions;
      let groupedActions = Object.values(data).flat();
      let ungroupedActions = actions.filter(action => !groupedActions.includes(action));
      data.default.push(...ungroupedActions);
      
      let groupElements = [...root.querySelectorAll('multitasking-action-group')];
      let newGroupElements = [];
      Object.entries(data).forEach(([groupID, groupActions]) => {
        let groupElement = groupElements.find(group => group.id === `${namespace}:${groupID}`);
        if(groupElement === undefined) {
          groupElement = document.createElement('multitasking-action-group');
          groupElement.id = `${namespace}:${groupID}`;
          
          const tabSortable = new Sortable(groupElement.container, {
            group: {
                name: 'multitask-action-group',
                pull: true,
                put: true
            },
            draggable: 'multitasking-action',
            onAdd: (event) => {
                if (event.newIndex === undefined || event.oldIndex === undefined)
                    return;
                console.log(event.item);
                //itemContainer.append(event.item);
                //bank.moveItemToNewTab(this.getFromTabID(event.from), tabID, event.oldIndex);
                //this.validateItemOrder();
                //tabLink.classList.remove('bg-combat-menu-selected');
            }
          });
        }
        groupElement.name.textContent = groupID;
        let actionElements = [...groupElement.container.children];
        let newActions = groupActions.map((action, i) => {
          let actionElement = actionElements[i];
          if(actionElement === undefined)
            actionElement = createElement('multitasking-action');
          actionElement.setAttribute('action', action);
          return actionElement;
        });
        
        groupElement.container.replaceChildren(...newActions);
        newGroupElements.push(groupElement);
      });

      root.replaceChildren(...newGroupElements);




      console.log('set', root, data, actions);
    }
  });
  settings.section('Action Groups').add([
    {
      type: 'action-groups',
      name: 'groups',
      onChange: function(value, previousValue) {
          console.log('onChange', value, previousValue);
      }
    }
  ]);
  
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

  onCharacterLoaded(() => {
    game.multitasking.loadActions();
    game.multitasking.loadGroups();
  });
}