class SeriesTableElement extends HTMLElement {
    connectedCallback() {
        this.render();
    }
    render() {
        const data = this.data;
        if (!data) {
            this.innerHTML = `<p>No data to render table!</p>`;
            return;
        }
        if (!this.validateInput()) {
            throw new SeriesTableError('Malformed input. Failed to render component');
        }
        const header = data[0].reduce((acc, cur, index) => `${acc}<th>${cur}</th>${index === data[0].length - 1 ? '</tr>' : ''}`, '<tr>');
        data.shift();
        const rows = data.reduce((acc, cur, index) => acc + cur.reduce((a, c, i) => `${a}<td>${c}</td>${i === data[index].length - 1 ? '</tr>' : ''}`, '<tr>'), '');
        this.innerHTML = `<table>${header}${rows}</table>`;
    }
    get data() {
        const data = this.getAttribute('data-series');
        if (data) {
            return JSON.parse(data);
        }
        return null;
    }
    set data(val) {
        if (val) {
            this.setAttribute('data-series', JSON.stringify(val));
        }
        else {
            this.removeAttribute('data-series');
        }
    }
    validateInput() {
        let valid = true;
        const dataToValidate = this.data;
        if (!dataToValidate) {
            return valid;
        }
        const slicedData = dataToValidate.slice(1);
        for (const element of slicedData) {
            if (element.length === 0) {
                valid = false;
            }
            if (element.length !== dataToValidate[0].length) {
                valid = false;
                break;
            }
        }
        return valid;
    }
}
class SeriesTableError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SeriesTableError';
    }
}
export default SeriesTableElement;
if (!window.customElements.get('series-table')) {
    window.SeriesTableElement = SeriesTableElement;
    window.SeriesTableError = SeriesTableError;
    window.customElements.define('series-table', SeriesTableElement);
}
