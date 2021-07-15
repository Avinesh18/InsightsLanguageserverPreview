import * as Highcharts from 'highcharts'
import '@github/insights-query-element'
import '@github/series-table-element'

const apiURL = "https://insights.github.com/sql/api"
//const apiURL = "http://localhost:8080";

const targetNode = document.querySelector('body');
const config = { attributes: true, childList: true, subtree: true };
const callback = async function(mutationsList, observer) {
    for(const mutation of mutationsList)
        for(const node of mutation.addedNodes)
            if(node instanceof InsightsQueryElement)
            {
                let formattedSeries = await getFormattedSeries(node);
                node.generateTable(formattedSeries);
            }
};
const observer = new MutationObserver(callback);

observer.observe(targetNode, config);

async function getFormattedSeries(node) {
    if(sessionStorage.getItem(node.query))
    {
        let data = JSON.parse(sessionStorage.getItem(node.query));
        return node.formatData(data);
    }
    else
    {
        let data = await node.executeQuery();
        sessionStorage.setItem(node.query, JSON.stringify(data));
        return node.formatData(data);
    }
}

async function getData(insightsElement) {
    let innerDiv = insightsElement.querySelector('div');
    const token = innerDiv.getAttribute('access-token');
    const scope = innerDiv.getAttribute('scope');
    const query = innerDiv.innerHTML;

    if(sessionStorage.getItem(query))
        return JSON.parse(sessionStorage.getItem(query));
    else {
        const response = await fetch(apiURL, {
            method: 'POST',
            headers: {
                'Authorization': token,
                'X-PAT-Scope': scope,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({query: query})
        })

        if(response.status != 200) {
            throw new Error(response.statusText);
        }

        let { data, errors } = await response.json();
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
    const properties = ["y", "m", "d", "h", "m", "s", "ms"];
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

    const properties = ["y", "m", "d", "h", "m", "s", "ms"];
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

function highchartsPlot(containerID, data)
{
    const noColumns = data.columns.length;
    if(noColumns > 2)
        throw new Error("Too many columns");
    else if(noColumns < 2)
        throw new Error("Too few columns");

    const validXDataTypes = ["string", "number", "bigint", "datetime", "nvarchar", "tinyint"];
    const validSeriesDataTypes = ["number", "bigint", "datetime", "tinyint"];
    if(!validXDataTypes.includes(data.columns[0].dataType) || !validSeriesDataTypes.includes(data.columns[1].dataType))
        throw new Error("Can't plot this type of data", data.columns[0].dataType, data.columns[1].dataType);

    const xLabel = data.columns[0].name;
    const yLabel = data.columns[1].name;
    let xVals = [];
    let yVals = [];
    let ySuffix = "";

    data.rows.forEach(ele => {
        xVals.push(ele[0]);
        yVals.push(ele[1]);
    })


    let month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if(data.columns[0].dataType == "datetime") 
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
    if(data.columns[1].dataType == "datetime")
    {
        let {series, unit} = getNumberSeries(yVals);
        yVals = series;
        ySuffix = unit;
    }

    let highchartsOptions  = {
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

const insightsElements = document.getElementsByClassName("language-insights");

/*(async function() {
    for(var i = 0; i < insightsElements.length; ++i)
    {
        try {
            let data = await getData(insightsElements[i]);
            let containerID = `insightsChartContainer${i}`
            insightsElements[i].innerHTML = `<div id="${containerID}"></div>`;
            highchartsPlot(containerID, data);
        }
        catch(e) {
            console.error(e);
            insightsElements[i].innerHTML = e.message.toUpperCase();
        }
    }
})()*/

for(var i = 0; i<insightsElements.length; ++i)
{
    let innerDiv = insightsElements[i].querySelector('div');
    let token = innerDiv.getAttribute('access-token');
    let scope = innerDiv.getAttribute('scope');
    insightsElements[i].innerHTML = `<insights-query exec-type="1" data-auth="${token}" scope="${scope}" data-api="${apiURL}" data-query="${innerDiv.innerHTML}"></insights-query>`;
}