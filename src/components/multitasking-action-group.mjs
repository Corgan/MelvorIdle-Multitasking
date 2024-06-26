const { settings, characterStorage, patch, api } = mod.getContext(import.meta);

class MultitaskingActionGroupElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('multitasking-action-group-template'));
        this.name = getElementFromFragment(this._content, 'name', 'h5');
        this.container = getElementFromFragment(this._content, 'actions-container', 'div');
    }
    connectedCallback() {
        this.appendChild(this._content);
    }
}
window.customElements.define('multitasking-action-group', MultitaskingActionGroupElement);

export { MultitaskingActionGroupElement }