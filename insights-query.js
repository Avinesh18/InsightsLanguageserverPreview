const TELEMETRY_KEY = 'insights-query-telemetry';
const BASE_TELEMETRY_OPTIONS = { bubbles: true, cancelable: true };
class InsightsQueryElement extends HTMLElement {

    /**
    * 0 means query is executed automatically when the web component is connected to DOM
    * 1 means we have to explicitly call necessary functions to fetch response and generate table
    */
    get execType() {
        let execType = this.getAttribute('exec-type');
        if(!execType || execType == 0)
            return 0;
        else
            return 1;
    }
    set execType(val)
    {
        if(val)
            this.setAttribute('exec-type', val);
        else 
            this.removeAttribute('exec-type');
    }


    async connectedCallback() {
        let execType = this.execType;
        if(execType == 0) {
            let data = await this.executeQuery();
            if(!data)
                return;

            let formattedSeries = this.formatData(data);
            this.generateTable(formattedSeries);
        }

    }
    
    get query() {
        let query = this.getAttribute('data-query');
        if (query) {
            return query;
        }
        const queryContainerId = this.getAttribute('data-query-container-id');
        if (queryContainerId) {
            const queryContainer = document.getElementById(queryContainerId);
            if (queryContainer) {
                query = queryContainer instanceof HTMLInputElement ? queryContainer.value : queryContainer.textContent;
            }
        }
        return query;
    }
    set query(val) {
        if (val) {
            this.setAttribute('data-query', val);
        }
        else {
            this.removeAttribute('data-query');
        }
    }

    get api() {
        return this.getAttribute('data-api');
    }
    set api(val) {
        if (val) {
            this.setAttribute('data-api', val);
        }
        else {
            this.removeAttribute('data-api');
        }
    }

    get auth() {
        return this.getAttribute('data-auth');
    }
    set auth(val) {
        if (val) {
            this.setAttribute('data-auth', val);
        }
        else {
            this.removeAttribute('data-auth');
        }
    }

    get scope() {
        return this.getAttribute('scope');
    }
    set scope(val) {
        if(val)
            this.setAttribute('scope', val);
        else
            this.removeAttribute('scope');
    }

    async executeQuery() {
        const query = this.query;
        const apiUrl = this.api;
        if (!apiUrl || !query) {
            return;
        }

        const auth = this.auth;

        let token;
        let scope;

        //A github PAT always begins with "ghp_"
        if(auth.match(/^ghp_/)) {
            token = auth;
            scope = this.scope;
        }
        else {
            let tokenAndScope = await this.fetchTokenAndScope();
            token = tokenAndScope.token;
            scope = tokenAndScope.scope;
        }

        if (!token || !scope) {
            return;
        }
        try {
            /*const response = await fetch(apiUrl, {
                method: 'POST',
                body: JSON.stringify({ query }),
                headers: { Authorization: token, 'X-Auth-Scope': scope, 'Content-Type': 'application/json' }
            });*/
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    "Authorization": token,
                    "X-PAT-Scope": scope,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ query: query })
            });

            if (response.status !== 200) {
                throw new Error(`Insights API returned status code: ${response.status}`);
            }
            const decodedResponse = await response.json();
            const { data, errors } = decodedResponse;
            if (errors && errors.hasErrors) {
                throw new Error('Insights API Error');
            }
            return data;
        }
        catch (e) {
            this.innerHTML = e.message;
            this.dispatchEvent(new CustomEvent(TELEMETRY_KEY, Object.assign(Object.assign({}, BASE_TELEMETRY_OPTIONS), { detail: { incrementKey: 'execute-error' } })));
            throw new InsightsDataFetchError(e.message);
        }
    }

    async fetchTokenAndScope() {
        const authUrl = this.auth;
        if (!authUrl) {
            return { token: null, scope: null };
        }
        try {
            const authResponse = await fetch(authUrl, {
                headers: {
                    Accept: 'application/json'
                }
            });
            const { token, scope } = await authResponse.json();
            return { token, scope };
        }
        catch (e) {
            this.dispatchEvent(new CustomEvent(TELEMETRY_KEY, Object.assign(Object.assign({}, BASE_TELEMETRY_OPTIONS), { detail: { incrementKey: 'token-fetch-error' } })));
            throw new InsightsTokenFetchError(e.message);
        }
    }
    
    formatData(rawData) {
        return [rawData.columns.map(d => d.name), ...rawData.rows];
    }

    generateTable(formattedSeries)
    {
        try {
            this.innerHTML = `<series-table data-series='${JSON.stringify(formattedSeries)}'></series-table>`;
            this.dispatchEvent(new CustomEvent(TELEMETRY_KEY, Object.assign(Object.assign({}, BASE_TELEMETRY_OPTIONS), { detail: { incrementKey: 'execute-success' } })));
        }
        catch(e) {
            this.innerHTML = e.message;
            this.dispatchEvent(new CustomEvent(TELEMETRY_KEY, Object.assign(Object.assign({}, BASE_TELEMETRY_OPTIONS), { detail: { incrementKey: 'execute-error' } })));
            throw new InsightsDataFetchError(e.message);
        }
    }
}
class InsightsTokenFetchError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InsightsTokenFetchError';
    }
}
class InsightsDataFetchError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InsightsDataFetchError';
    }
}


window.InsightsQueryElement = InsightsQueryElement;
window.InsightsTokenFetchError = InsightsTokenFetchError;
window.InsightsDataFetchError = InsightsDataFetchError;
window.customElements.define('insights-query', InsightsQueryElement);