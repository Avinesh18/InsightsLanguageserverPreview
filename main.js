/*import * as Highcharts from 'highcharts'
import '@github/insights-query-element'
import '@github/series-table-element'

var insightsDivElements = document.getElementsByClassName("language-insights");

function* getData(insightsDivElements)
{
    for(var i=0; i<insightsDivElements.length; ++i)
    {
        var innerDiv = insightsDivElements[i].getElementsByTagName("div")[0];
        var query = innerDiv.innerHTML;
        var accessToken = innerDiv.getAttribute("access-token");

        if(sessionStorage.getItem(query))
            yield sessionStorage.getItem(query);
        else
            yield fetch("http://localhost:8080", {
                method: 'POST',
                headers: {
                    "Authorization": "token " + accessToken,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({query: query})
            });
        
    }
}

/**
* Makes a separate array for each column from the server response
*
function getDataset(rows)
{
    let month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var dataset = new Array(rows[0].length).fill(0).map(() => new Array(0));
    rows.forEach((val) => {
        val.forEach((ele, index) => {
            let fullDate = new Date(Date.parse(ele));
            let day = fullDate.getUTCDate();
            let m = month[fullDate.getUTCMonth()];
            let year = fullDate.getUTCFullYear();
            let hours = fullDate.getUTCHours();
            dataset[index].push(index == 0 ? m + " " + day : hours);
        })
    })
    console.log(dataset);
    return dataset;
}

function highchartsPlot(containerID, dataset, labels)
{
    let xAxis;
    let series = [];

    dataset.forEach((value, index) => {
        if(index == 0)
        {
            xAxis = {
                title: {
                    text: labels[index]
                },
                categories: value
            }
        }
        else
        {
            series.push({
                name: labels[index],
                data: value
            })
        }
    })

    let highchartsOptions  = {
        chart: {
            height: window.innerHeight/2
        },
        title: {
            text: ""
        },
        yAxis: {
            labels: {
                format: '{text} h'
            },
            title:
            {
                text: ""
            }
        },
        plotOptions: {
            series:
            {
                animation: false
            }
        },
        xAxis: xAxis,
        series: series
    }

    Highcharts.chart(containerID, JSON.parse(JSON.stringify(highchartsOptions)));
}

(async function() {
    var i = 0;
    var generator = getData(insightsDivElements);

    var plotNext = () => {
        var {value, done} = generator.next();

        if(!done && value instanceof Promise)
        {
            value.then(response => {
                if(response.status != 200)
                    throw new Error(response.statusText);

                return response.json();
            })
            .then( data => {
                    let query = document.getElementsByClassName('language-insights')[i].getElementsByTagName('div')[0].innerHTML;
                    if(!sessionStorage.getItem(query))
                        sessionStorage.setItem(query, JSON.stringify(data));

                    insightsDivElements[i].innerHTML = `<div id="insightsChartContainer${i}"></div>`;
                    highchartsPlot(`insightsChartContainer${i++}`, getDataset(data.data.rows), data.data.columns.map(e => e.name));
                })
            .catch(error => {
                insightsDivElements[i++].innerHTML = error.message.toUpperCase();
            })
            .then(plotNext)
        }
        else if(!done)
        {
            value = JSON.parse(value);
            insightsDivElements[i].innerHTML = `<div id="insightsChartContainer${i}"></div>`;
            highchartsPlot(`insightsChartContainer${i++}`, getDataset(value.data.rows), value.data.columns.map(e => e.name));
            plotNext();
        }
        else
            return;
    };

    plotNext();
})()


//test_element.innerHTML = insightsDivElements.length;

//let print = document.getElementsByClassName("language-print")[0];
const apiURL = "http://localhost:8080";
//const apiURL = "https://insights.github.com/sql/api";
const authURL = "";
for(var i = 0; i<insightsDivElements.length; ++i)
{
    let innerDiv = insightsDivElements[i].getElementsByTagName("div")[0];
    insightsDivElements[i].innerHTML = `<insights-query data-auth-api="${authURL}" data-api="${apiURL}" data-query="${innerDiv.innerHTML}"></insights-query>`;
}*/
import * as Highcharts from 'highcharts'
import '@github/insights-query-element'
import '@github/series-table-element'

const targetNode = document.querySelector('pre');

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
    const query = innerDiv.innerHTML;

    if(sessionStorage.getItem(query))
        return JSON.parse(sessionStorage.getItem(query));
    else {
        const apiURL = "http://localhost:8080";
        const response = await fetch(apiURL, {
            method: 'POST',
            headers: {
                'Authorization': token,
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

/**
* Makes a separate array for each column from the server response
*/
function getDataset(rows)
{
    let month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let week = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    var dataset = new Array(rows[0].length).fill(0).map(() => new Array(0));
    rows.forEach((val) => {
        val.forEach((ele, index) => {
            let fullDate = new Date(Date.parse(ele));
            let year = fullDate.getUTCFullYear();
            let m = month[fullDate.getUTCMonth()];
            let date = fullDate.getUTCDate();
            let day = week[fullDate.getUTCDay()];
            let hours = fullDate.getUTCHours();
            let minutes = fullDate.getUTCMinutes();
            let seconds = fullDate.getUTCSeconds();
            let milliseconds = fullDate.getUTCMilliseconds();

            //let x = year + "-" + m + "-" + date + " " + hours + ":" + minutes + ":" + seconds + "." + milliseconds;
            let x = m + " " + date;
            //let x = fullDate.toDateString();
            let y = hours;

            dataset[index].push(index == 0 ? x: y);
        })
    })
    return dataset;
}

function highchartsPlot(containerID, dataset, labels)
{
    let xAxis;
    let series = [];

    dataset.forEach((value, index) => {
        if(index == 0)
        {
            xAxis = {
                title: {
                    text: labels[index]
                },
                categories: value
            }
        }
        else
        {
            series.push({
                name: labels[index],
                data: value
            })
        }
    })

    let highchartsOptions  = {
        chart: {
            height: window.innerHeight/2
        },
        title: {
            text: ""
        },
        yAxis: {
            labels: {
                format: '{text} h'
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
        xAxis: xAxis,
        series: series
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
            highchartsPlot(containerID, getDataset(data.rows), data.columns.map(e => e.name));
        }
        catch(e) {
            insightsElements[i].innerHTML = e.message.toUpperCase();
        }
    }
})()*/

const apiURL = "http://localhost:8080";
const auth = "ghp_adfsd";
const scope = 9919;
for(var i = 0; i<insightsElements.length; ++i)
{
    let innerDiv = insightsElements[i].querySelector('div');
    insightsElements[i].innerHTML = `<insights-query exec-type="1" data-auth="${auth}" scope="${scope}" data-api="${apiURL}" data-query="${innerDiv.innerHTML}"></insights-query>`;
}