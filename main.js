import * as d3 from 'd3';

var d3plot = function(containerID, dataset, labels) {

    var yMax = 0;
    var xMax = 0;
    dataset.forEach( array => {
        xMax = xMax > array.length ? xMax : array.length;
        array.forEach(e => {
            yMax = yMax > e ? yMax : e;
        })
    })

    var margin = {top: 5, right: 10, bottom: 20, left: 30}
    , width = window.innerWidth/1.375 - margin.left - margin.right 
    , height = window.innerHeight/4 - margin.top - margin.bottom;

    var n = xMax;

    var xScale = d3.scaleLinear()
        .domain([0, n-1]) 
        .range([0, width]);

    var yScale = d3.scaleLinear()
        .domain([0, yMax]) 
        .range([height, 0]);

    var line = d3.line()
        .x(function(d, i) {return xScale(i); }) 
        .y(function(d) { return yScale(d);}) 

    var svg = d3.select(`#${containerID}`).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
        .attr("style", "position: fixed");

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale));

    svg.append("g")
        .attr("class", "y axis")
        .call(d3.axisLeft(yScale).ticks(5));

    const noColors = 7;
    const colors = ["#FFFF00","#FF0000", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF", "#00000"]

    for(var i = 0; i < dataset.length; ++i)
    {
        var temp = dataset[i];
        svg.append("path")
            .datum(temp)
            .attr("class", "line")
            .attr("d", line)
            .attr("style", `fill: none;    stroke: ${colors[i % noColors]};   stroke-width: 2;`); 

        svg.selectAll(`.dot${i}`)
            .data(temp)
            .enter().append("circle")
            .attr("class", "dot")
            .attr("cx", function(d, i) { return xScale(i) })
            .attr("cy", function(d) { return yScale(d) })
            .attr("r", 5)
            .attr("style", `fill: ${colors[i % noColors]}`);
    }
    d3.select(`#${containerID}`).append("br");

    const labelWidth = 40;
    const labelHeight = 10;

    labels.forEach((label, index) => {
        d3.select(`#${containerID}`)
        .append("svg")
        .attr("width", labelWidth)
        .attr("height", labelHeight)
        .append("rect")
        .attr("width", labelWidth)
        .attr("height", labelHeight)
        .attr("style", `fill: ${colors[index % noColors]}`);

        d3.select(`#${containerID}`)
        .append("text")
        .text(" " + label)
        .append("br");
    })
}

var insightsDivElements = document.getElementsByClassName("language-insights");

function* getData(insightsDivElements)
{
    for(var i=0; i<insightsDivElements.length; ++i)
    {
        var innerDiv = insightsDivElements[i].getElementsByTagName("div")[0];
        var query = innerDiv.innerHTML;
        var accessToken = innerDiv.getAttribute("accessToken");
        if(sessionStorage.getItem(query))
            yield sessionStorage.getItem(query);
        else
            yield fetch("http://localhost:8080", {
                method: 'POST',
                headers: {
                    "Authorization": "Basic " + btoa(accessToken),
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({query: query})
            });
        
    }
}

/**
* Makes a separate array for each column from the server response
*/
function getDataset(rows)
{
    var dataset = new Array(rows[0].length).fill(0).map(() => new Array(0));
    rows.forEach((val) => {
        val.forEach((ele, index) => {
            dataset[index].push(parseInt(ele));
        })
    })
    console.log(dataset);
    return dataset;
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
                    d3plot(`insightsChartContainer${i++}`, getDataset(data.data.rows), data.data.columns.map(e => e.name));
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
            d3plot(`insightsChartContainer${i++}`, getDataset(value.data.rows), value.data.columns.map(e => e.name));
            plotNext();
        }
        else
            return;
    };

    await plotNext();
})()