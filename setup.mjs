export async function setup({ namespace, loadTemplates, gameData, loadModule, loadScript, onInterfaceAvailable, onModsLoaded, onCharacterLoaded, onInterfaceReady, patch, settings }) {
  await loadTemplates("templates.html"); // Add templates

  const { MultitaskingActionGroupElement } = await loadModule('src/components/multitasking-action-group.mjs');
  const { MultitaskingActionElement } = await loadModule('src/components/multitasking-action.mjs');

  /*
  */
  settings.type('action-groups', {
    render: function(name, onChange, config) {
      const root = document.createElement('div');
      root.id = name;

      root._onchange = onChange;
    
      return root;
    },
    get: function(root) {
      let groupElements = [...root.querySelectorAll('multitasking-action-group')];
      let groups = {};

      groupElements.forEach(groupElement => {
        let [ groupNamespace, groupID ] = groupElement.id.split(':');
        let count = groupElement.count;

        let actionElements = [...groupElement.container.querySelectorAll('multitasking-action')];
        let actions = actionElements.map(actionElement => actionElement.getAttribute('action'));

        groups[groupID] = { count, actions };
      });

      if(groups.default === undefined) {
        groups.default = { count: 0, actions: [] };
      }

      return groups;
    },
    set: function(root, data) {
      const actions = game.multitasking.validActions;
      if(data === null|| data === undefined || data.default === undefined) {
        data = { default: { count: 0, actions: [...actions] } };
      }
      let groupedActions = Object.values(data).flatMap(group => group.actions);
      let ungroupedActions = actions.filter(action => !groupedActions.includes(action));
      data.default.actions.push(...ungroupedActions);

      let groupElements = [...root.querySelectorAll('multitasking-action-group')];
      let newGroupElements = [];
      Object.entries(data).forEach(([groupID, groupData]) => {
        let groupElement = groupElements.find(group => group.id === `${namespace}:${groupID}`);
        if(groupElement === undefined) {
          groupElement = document.createElement('multitasking-action-group');
          groupElement.id = `${namespace}:${groupID}`;
          groupElement._onchange = root._onchange;
          groupElement.remove.classList.toggle('d-none', groupID === 'default');
        }

        groupElement.name.textContent = groupID;
        groupElement.count = groupData.count;
        
        let actionElements = [...groupElement.container.children];

        let newActions = groupData.actions.map((action, i) => {
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
    }
  });
  settings.type('button-callback', {
      render: function(name, onChange, config) {
          const button = createElement('button', {
              id: name,
              classList: ['btn', 'btn-success', 'font-size-sm'],
              children: [config.text]
          });
          button.onclick = () => game.multitasking.addNewGroup();
          return button;
      },
      get: function(root) {},
      set: function(root, data) {
      }
  });
  settings.section('Action Groups').add([
    {
      type: 'action-groups',
      name: 'groups',
      onChange: function(value, previousValue) {
          game.multitasking.setGroups(value);
      }
    },
    {
      type: 'button-callback',
      name: 'add-new',
      text: 'Add New Group'
    }
  ]);
  
  const { Multitasking } = await loadModule('src/multitasking.mjs');

  let multitasking = new Multitasking(game.registeredNamespaces.getNamespace('multitasking'), 'multitasking', game);

  game.multitasking = multitasking;
  game.actions.registerObject(multitasking);
  game.activeActions.registerObject(multitasking);

  await gameData.addPackage('data/data.json'); // Add skill data (page + sidebar, skillData)

  let thievingOverride = true;

  onModsLoaded(() => {
    patch(Thieving, 'resetActionState').replace(function(o) {
      if(this.isActive && !thievingOverride)
        o();
    });

    patch(Game, 'onLoad').after(function() {
      thievingOverride = false;
    });

    patch(Game, 'idleChecker').replace(function(o, skill) {
      if(this.activeAction === multitasking) {
          return false;
      }
      return o(skill);
    });

    patch(Game, 'clearActiveAction').replace(function(o, save=true) {
      if (!this.disableClearOffline) {
          this.activeAction = multitasking.hasActive ? multitasking : undefined;
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
        if(this.activeAction === multitasking && (multitasking.hasAction(this.combat) || multitasking.hasAction(this.thieving))){
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
        if(this.activeAction === multitasking && (multitasking.hasAction(this.combat))) {
          showElement(minibar);
        } else {
          hideElement(minibar);
        }
      }
    });

    patch(BaseManager, 'checkDeath').before(function() {
      const playerDied = this.player.hitpoints <= 0;
      if(playerDied && multitasking.hasAction(this.game.thieving))
        this.game.thieving.stopOnDeath();
    });

    patch(CombatManager, 'onSelection').after(function() {
      let added = multitasking.addAction(this);
      if(!added)
        this.stop();
      if(multitasking.hasActive)
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
              let added = multitasking.addAction(this);
              if(!added)
                this.stop();
              if(multitasking.hasActive)
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
                  let added = multitasking.addAction(this);
                  if(!added)
                    this.stop();
                  if(multitasking.hasActive)
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
  });

  onCharacterLoaded(() => {
    console.log('onCharacterLoaded');
    game.multitasking.loadActions();
    game.multitasking.loadGroups();
    game.activeActions.forEach(action => {
      if(action.isActive && action !== multitasking) {
        let added = multitasking.addAction(action);
        if(!added)
          action.stop();
      }
    });
    if(game.activeAction === multitasking && !multitasking.hasActive) {
      game.activeAction = undefined;
    }
  });
}