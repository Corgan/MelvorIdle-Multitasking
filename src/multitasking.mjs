const { settings, characterStorage, patch, api } = mod.getContext(import.meta);

class Multitasking extends NamespacedObject {
    constructor(namespace, id, game) {
        super(namespace, id);
        this._media = 'assets/octopus.png';
        this.game = game;
        this.actions = new Set();
        this.isActive = true;
    }

    get name() {
        return "Multitasking";
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    addAction(action) {
        this.actions.add(action);
    }

    removeAction(action) {
        this.actions.delete(action);
    }

    get activeSkills() {
        return [...this.actions].flatMap(action => action.activeSkills);
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