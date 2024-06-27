const { settings, characterStorage, patch, api } = mod.getContext(import.meta);

class MultitaskingActionGroupElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('multitasking-action-group-template'));
        this.name = getElementFromFragment(this._content, 'name', 'h5');
        this.countElement = getElementFromFragment(this._content, 'count', 'settings-dropdown');
        this.container = getElementFromFragment(this._content, 'actions-container', 'div');
        this.remove = getElementFromFragment(this._content, 'remove', 'button');
        this._count = 0;
        this.options = [
            { name: '∞', value: 0 },
            { name: '1', value: 1 },
            { name: '2', value: 2 },
            { name: '3', value: 3 },
            { name: '4', value: 4 },
            { name: '5', value: 5 },
            { name: '10', value: 10 },
        ];
        this.init = false;
    }
    connectedCallback() {
        this.appendChild(this._content);
        
        if(!this.init) {
            this.countElement.initialize({
                name: '',
                options: this.options
            },
            (value) => {
                this.count = value
                this.countElement.updateValue(this.options.find(option => option.value === value));
                if(this._onchange !== undefined) {
                    this._onchange(this);
                }
            });
            this.countElement.updateValue(this.options.find(option => option.value === this._count));

            this.tabSortable = new Sortable(this.container, {
                group: {
                    name: 'multitask-action-group',
                    pull: true,
                    put: true
                },
                draggable: 'multitasking-action',
                onUnchoose: (event) => {
                    if (event.newIndex === undefined || event.oldIndex === undefined)
                        return;
                    if(this._onchange !== undefined) {
                        this._onchange(this);
                    }
                }
            });

            this.remove.onclick = () => {
                let [ namespace, groupID ] = this.id.split(':');
                game.multitasking.deleteGroup(groupID);
            };

            this.init = true;
        }
    }

    set onchange(handler) {
        this._onchange = handler;
    }

    set count(value) {
        this._count = value;
    }

    get count() {
        return this._count;
    }
}
window.customElements.define('multitasking-action-group', MultitaskingActionGroupElement);

export { MultitaskingActionGroupElement }