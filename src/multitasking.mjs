const { settings, characterStorage, patch, api } = mod.getContext(import.meta);

class Multitasking extends NamespacedObject {
    constructor(namespace, id, game) {
        super(namespace, id);
        this._media = 'assets/octopus.png';
        this.game = game;
        this.isActive = true;
        this.actionMap = new Map();
        this.actionGroups = new Map();
        this.validActions = [];
        this.invalidActions = ['melvorD:GolbinRaid', 'multitasking:multitasking'];
    }

    loadActions() {
        let validActions = game.activeActions.allObjects.filter(action => !this.invalidActions.includes(action.id)).map(action => action.id);
        this.validActions = validActions !== undefined ? validActions : [];
    }

    loadGroups() {
        this.groups = settings.section('Action Groups').get('groups');
        if(this.groups === null || this.groups === undefined || this.groups.default === undefined) {
            this.groups = { default: { count: 0, actions: [...this.validActions] } };
            settings.section('Action Groups').set('groups', this.groups);
        }
        this.updateActionMap();

        settings.section('Action Groups').set('add-new', this.addNewGroup);
    }

    setGroups(groups) {
        this.groups = groups;
        this.updateActionMap();
    }

    updateActionMap() {
        Object.entries(this.groups).forEach(([group, data]) => {
            data.actions.forEach(action => {
                this.actionMap.set(action, group);
            });
        });
    }

    addNewGroup() {
        let count = 1;
        while(this.groups[`group-${count}`] !== undefined)
            count++;
        this.groups[`group-${count}`] = {
            count: 0,
            actions: []
        };
        settings.section('Action Groups').set('groups', this.groups);
    }

    deleteGroup(groupKey) {
        if(groupKey === 'default')
            return;
        delete this.groups[groupKey];
        if(this.actionGroups.has(groupKey)) {
            let actionGroup = this.actionGroups.get(groupKey);
            actionGroup.forEach(action => action.stop());
            this.actionGroups.delete(groupKey);
        }
        settings.section('Action Groups').set('groups', this.groups);
    }

    get name() {
        return "Multitasking";
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    groupKeyFromAction(action) {
        let groupKey = this.actionMap.get(action.id);
        if(groupKey === undefined)
            groupKey = 'default';

        return groupKey;
    }

    actionGroupFromGroupKey(groupKey) {
        let actionGroup = this.actionGroups.get(groupKey);
        if(actionGroup === undefined) {
            actionGroup = new Set();
            this.actionGroups.set(groupKey, actionGroup);
        }
        return actionGroup;
    }

    addAction(action) {
        let groupKey = this.groupKeyFromAction(action);
        let group = this.groups[groupKey];
        let actionGroup = this.actionGroupFromGroupKey(groupKey);
        if((actionGroup.size < group.count || group.count === 0) || actionGroup.has(action)) {
            actionGroup.add(action);
            return true;
        }
        notifyPlayer(this, `Could not start ${action.name}. There are ${actionGroup.size} tasks running in ${groupKey}.`, 'danger');
        return false;
    }

    removeAction(action) {
        let groupKey = this.groupKeyFromAction(action);
        let actionGroup = this.actionGroupFromGroupKey(groupKey);
        actionGroup.delete(action);
    }

    hasAction(action) {
        return this.actions.includes(action);
    }

    get actions() {
        return [...this.actionGroups.values()].flatMap(actions => [...actions.values()]);
    }

    get activeSkills() {
        return [...this.actions].flatMap(action => action.activeSkills);
    }

    get hasActive() {
        return this.actions.length > 0 && this.actions.some(action => action.isActive);
    }

    start() {
        return true;
    }

    stop() {
        return true;
    }

    activeTick() {
        this.actions.forEach(action => action.activeTick());
    }

    onModifierChangeWhileActive() {
        this.actions.forEach(action => (action.onModifierChangeWhileActive !== undefined ? action.onModifierChangeWhileActive() : undefined));
    }

    getErrorLog() {

    }
}

export { Multitasking }