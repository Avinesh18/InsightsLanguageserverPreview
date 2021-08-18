import * as Highcharts from 'highcharts'
/*import '@github/insights-query-element'
import '@github/series-table-element'*/

//const apiURL = "https://insights.github.com/sql/api"
const apiURL = "http://localhost:8080";
const sqlApi = "http://localhost:9000";
//const sqlApi = "https://kqlsql.shaarad.me/api/sql"
//const sqlApi = "http://localhost:5000/api/sql"

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

            if (response.status != 200) {
                throw new Error(`Insights API returned status code: ${response.status}`);
            }

            const decodedResponse = await response.json();

            const { data, errors } = decodedResponse;
            if (errors && errors.hasErrors) {
                throw new Error('Insights API Error ' + errors.errorMessage);
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

class SeriesTableElement extends HTMLElement {
    connectedCallback() {
        this.render();
    }
    render() {
        const data = this.series;
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
    get series() {
        const data = this.getAttribute('series');
        if (data) {
            return JSON.parse(data);
        }
        return null;
    }
    set series(val) {
        if (val) {
            this.setAttribute('series', JSON.stringify(val));
        }
        else {
            this.removeAttribute('series');
        }
    }
    // check if the data input has a valid structure
    validateInput() {
        let valid = true;
        const dataToValidate = this.series;
        if (!dataToValidate) {
            return valid;
        }
        const slicedData = dataToValidate.slice(1);
        for (const element of slicedData) {
            // check for an empty row
            if (element.length === 0) {
                valid = false;
            }
            // check for size of a row not matching the header's size
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



const targetNode = document.querySelector('body');
const config = { attributes: true, childList: true, subtree: true };
const callback = async function(mutationsList, observer) {
    for(const mutation of mutationsList)
        for(const node of mutation.addedNodes)
            if(node instanceof InsightsQueryElement)
            {
                try {
                    let formattedSeries = await getFormattedSeries(node);
                    if(!formattedSeries)
                        continue;
                    node.generateTable(formattedSeries);
                }
                catch(e) {
                    node.innerHTML = e.message;
                }
            }
};
const observer = new MutationObserver(callback);

observer.observe(targetNode, config);

async function getFormattedSeries(node) {
    let kqlQuery = decodeURIComponent(node.query).replace("&gt;", ">").replace("&lt;", "<");
    if(sessionStorage.getItem(kqlQuery))
    {
        let cacheData = JSON.parse(sessionStorage.getItem(kqlQuery));
        if(cacheData.error)
            throw new Error(cacheData.error);
        return node.formatData(cacheData);
    }
    else
    {
        let sqlQuery = await getSqlQuery(kqlQuery);
        node.query = sqlQuery;

        let data;
        try {
            data = await node.executeQuery();
        }
        catch(e) {
            if(e.message != "Failed to fetch")
                sessionStorage.setItem(kqlQuery, JSON.stringify({ error: e.message }));
            throw e;
        }

        if(!data)
            return data;
        sessionStorage.setItem(kqlQuery, JSON.stringify(data));
        return node.formatData(data);
    }
}

async function getSqlQuery(kqlQuery) {

    const response = await fetch(sqlApi, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({query: kqlQuery})
    });
    if(response.status != 200)
    {
        throw new Error("SQL API Error: " + response.status);
    }

    let data = await response.json();

    return data.query;
}

async function getData(insightsElement) {
    let innerDiv = insightsElement.querySelector('div');
    const token = innerDiv.getAttribute('access-token');
    const scope = innerDiv.getAttribute('scope');

    if(!token || !scope)
        throw new Error("Credentials not set");

    const query = innerDiv.innerHTML.replace("&gt;", ">").replace("&lt;", "<");

    if(query.trim() == "")
        return null;

    if(sessionStorage.getItem(query))
    {
        let cacheData = JSON.parse(sessionStorage.getItem(query));
        if(cacheData.error)
            throw new Error(cacheData.error);
        return cacheData;
    }
    else {
        const sqlQuery = await getSqlQuery(query);
        
        const response = await fetch(apiURL, {
            method: 'POST',
            headers: {
                'Authorization': token,
                'X-PAT-Scope': scope,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({query: sqlQuery})
        })

        if(response.status != 200) {
            throw new Error(`Insights API returned status code: ${response.status}`);
        }

        let { data, errors } = await response.json();

        if(errors && errors.hasErrors)
        {
            sessionStorage.setItem(query, JSON.stringify({ error: "Insights API Error" }))
            throw new Error("Insights API Error");
        }

        sessionStorage.setItem(query, JSON.stringify(data));
        return data;
    }
}

function parseDate(ele)
{
    let fullDate = new Date(Date.parse(ele));
    let year = fullDate.getUTCFullYear();
    let month = fullDate.getUTCMonth();
    let date = fullDate.getUTCDate();
    let hours = fullDate.getUTCHours();
    let minutes = fullDate.getUTCMinutes();
    let seconds = fullDate.getUTCSeconds();
    let milliseconds = fullDate.getUTCMilliseconds();

    return {
        year: year,
        month: month,
        date: date,
        hours: hours,
        minutes: minutes,
        seconds: seconds,
        milliseconds: milliseconds
    }
}

function getProperties(series, include)
{
    const properties = ["y", "m", "d", "h", "min", "s", "ms"];
    let includeArray = Object.entries(include);
    var start = -1;
    var end = -1;
    includeArray.forEach((ele, index) => {
        if(ele[1] && start == -1)
            start = index;
        else if(start != -1 && end == -1 && !ele[1])
            end = index-1;
    });
    if(end == -1)
        end = includeArray.length - 1;

    const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const MONTH_INDEX = 1;
    const HOURS_INDEX = includeArray.length - 4;
    const MINUTES_INDEX = includeArray.length - 3;
    let finalSeries = series.map(ele => {
        let properties = Object.entries(parseDate(ele));
        var first = true;
        let val = "";
        for(var i = start; i <= end; ++i)
        {
            if(!first && i >= MINUTES_INDEX)
                val += ":";

            if(i == MONTH_INDEX)
                val += month[properties[i][1]];
            else
                val += properties[i][1];

            if(i < HOURS_INDEX)
                val += " ";

            first = false;
        }

        return val;
    });

    let unit = properties[start];

    return {series: finalSeries, unit: unit};
}

function changedProperties(series) 
{
    var previous = parseDate(series[0]);
    var diff = (a, b) => {
        return {
            year: a.year != b.year,
            month: a.month != b.month,
            date: a.date != b.date,
            hours: a.hours != b.hours,
            minutes: a.minutes != b.minutes,
            seconds: a.seconds != b.seconds,
            milliseconds: a.milliseconds != b.milliseconds
        }
    }
    var or = (a,b) => {
        return {
            year: a.year | b.year,
            month: a.month | b.month,
            date: a.date | b.date,
            hours: a.hours | b.hours,
            minutes: a.minutes | b.minutes,
            seconds: a.seconds | b.seconds,
            milliseconds: a.milliseconds | b.milliseconds
        }
    }
    var changed = {
        year: false,
        month: false,
        date: false,
        hours: false,
        minutes: false,
        seconds: false,
        milliseconds: false
    };

    series.forEach(ele => {
        let current = parseDate(ele);
        changed = or(changed, diff(current, previous));
        previous = current;
    })

    return changed;
}

function getNumberSeries(series)
{
    let changed = changedProperties(series);

    const properties = ["y", "m", "d", "h", "min", "s", "ms"];
    const conversionFactor = [-1, 12, 30, 24, 60, 60, 1000];
    let changedArray = Object.entries(changed);
    var start = -1;
    var end = -1;
    changedArray.forEach((ele, index) => {
        if(ele[1] && start == -1)
            start = index;
        else if(start != -1 && end == -1 && !ele[1])
            end = index-1;
    });
    if(end == -1)
        end = changedArray.length - 1;
    if(start == -1)
        start = changedArray.length - 1; //No reason, just avoiding Error

    let finalSeries = series.map((ele, index) => {
        let dateArray = Object.entries(parseDate(new Date(Date.parse(ele))));
        let val = 0;
        for(var i = end; i > start; --i)
        {
            val = (val + dateArray[i][1]) / conversionFactor[i]
        }
        val = val + dateArray[start][1];
        return val;
    });

    let unit = properties[start];

    return {series: finalSeries, unit: unit};
}

function validateData(data)
{
    const noColumns = data.columns.length;
    if(noColumns > 2)
        throw new Error("Too many columns");
    else if(noColumns < 2)
        throw new Error("Too few columns");

    const validXDataTypes = ["string", "number", "bigint", "datetime", "datetimeoffset", "nvarchar", "tinyint", "bigint"];
    const validSeriesDataTypes = ["number", "bigint", "datetime", "datetimeoffset", "tinyint", "bigint"];
    if(!validXDataTypes.includes(data.columns[0].dataType) || !validSeriesDataTypes.includes(data.columns[1].dataType))
        throw new Error("Can't plot this type of data: " + data.columns[0].dataType + ", " +  data.columns[1].dataType);
}

function highchartsPlot(containerID, data)
{
    const xLabel = data.columns[0].name;
    const yLabel = data.columns[1].name;
    let xVals = [];
    let yVals = [];
    let ySuffix = "";

    data.rows.forEach(ele => {
        xVals.push(ele[0]);
        yVals.push(ele[1]);
    })


    const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if(data.columns[0].dataType == "datetime" || data.columns[0].dataType == "datetimeoffset") 
    {
        let {series, unit} = getProperties(xVals, changedProperties(xVals));
        if(unit == "d")
        {
            series = data.rows.map(ele => {
                let fullDate = new Date(Date.parse(ele[0]));
                return month[fullDate.getUTCMonth()] + " " + fullDate.getUTCDate();
            })
        }
        xVals = series;
    }
    if(data.columns[1].dataType == "datetime" || data.columns[1].dataType == "datetimeoffset")
    {
        let {series, unit} = getNumberSeries(yVals);
        yVals = series;
        ySuffix = unit;
    }

    let highchartsOptions  = {
        chart: {
            height: window.innerHeight/2.5
        },
        title: {
            text: ""
        },
        yAxis: {
            labels: {
                format: '{text} ' + ySuffix
            },
            title: {
                text: ""
            }
        },
        plotOptions: {
            series: {
                animation: false
            }
        },
        xAxis: {
            title: {
                text: xLabel
            },
            categories: xVals
        },
        series: [
            {
                name: yLabel,
                data: yVals
            }
        ]
    }

    Highcharts.chart(containerID, highchartsOptions);
}

async function insightsCharts(insightsElements) {
    for(var i = 0; i < insightsElements.length; ++i)
        {
            try {
                let data = await getData(insightsElements[i]);
                if(!data)
                    continue;

                validateData(data);

                let containerID = `insightsChartContainer${i}`
                insightsElements[i].innerHTML = `<div id="${containerID}"></div>`;

                highchartsPlot(containerID, data);
            }
            catch(e) {
                insightsElements[i].innerHTML = e.message;
            }
        }
}

async function insightsTables(insightsElements) {
    for(var i = 0; i<insightsElements.length; ++i)
        {
            try {
                let innerDiv = insightsElements[i].querySelector('div');
                let token = innerDiv.getAttribute('access-token');
                let scope = innerDiv.getAttribute('scope');
                
                if(!token || !scope)
                    throw new Error("Credentials not set");

                let query = innerDiv.innerHTML;
                if(query.trim() != "") 
                {
                    //encoding the query so that it doesn't get terminated in case there are any double quotes
                    insightsElements[i].innerHTML = `<insights-query exec-type="1" data-auth="${token}" scope="${scope}" data-api="${apiURL}" data-query="${encodeURIComponent(query)}"></insights-query>`;
                }
            }
            catch(e) {
                insightsElements[i].innerHTML = e.message;
            }
        }
}

try {

    const insightsElements = document.getElementsByClassName("language-insights");
    const plotChart = true;

    if(plotChart)
        insightsCharts(insightsElements);
    else
        insightsTables(insightsElements);
}
catch(e) {}