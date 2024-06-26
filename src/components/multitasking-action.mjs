const { settings, characterStorage, patch, api } = mod.getContext(import.meta);

class MultitaskingActionElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('multitasking-action-template'));
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
    }
    connectedCallback() {
        this.appendChild(this._content);
    }
    updateIcon() {
        const actionID = this.getAttribute('action');
        const action = game.actions.getObjectByID(actionID);
        if(action !== undefined && action.media !== undefined)
            this.icon.src = action.media;
    }
    attributeChangedCallback(name, oldValue, newValue) {
        if(oldValue !== newValue || this.icon.src === '')
           this.updateIcon();
    }
    static get observedAttributes() {
        return ['action'];
    }
}
window.customElements.define('multitasking-action', MultitaskingActionElement);

export { MultitaskingActionElement }