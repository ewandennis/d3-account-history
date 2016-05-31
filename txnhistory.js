// Draw credits as upwards bars, debits as downwards bars and a balance line
// Params:
//  - crs: array of credits {x: datestamp, y: txnvalue}
//  - drs: array of debits {x: datestamp, y: txnvalue}
//  - svg: element to render to
//  - options:
//    - allTxns: array of {date: datestamp, balance: number} for rendering balance line
//    - drawBalance: flag
//    - xrange: [left, right]
//    - yrange: [top, bottm]
//    - barWidth
//    - creditColour: CSS colour string
//    - debitColour: CSS colour string
//    - chartName: CSS class prefix 
function drawTxnHistory(crs, drs, svg, options) {
  let allTxns = options.allTxns || []
    , chartExtent = options.allTxns?
        d3.extent(allTxns, d=>d.date) : d3.extent(crs, d=>d.x)
    , xrange = options.xrange || [0, 100]
    , yrange = options.yrange || [0, 100]
    , width = xrange[1] - xrange[0]
    , height = yrange[1] - yrange[0]
    , barWidth = options.barWidth || width / crs.length
    , drawBalance = options.drawBalance || false
    , creditColour = options.creditColour || 'rgb(0, 255, 0)'
    , debitColour = options.debitColour || 'rgb(255, 0, 0)'
    , chartName = options.chartName;

  // X scale is just linear time.
  // Y scale is 2x the extent of transaction values so we can put
  // credits above the x axis and debits below.
  var crmax = d3.max(crs, d => d.y);
  var drmax = d3.max(drs, d => d.y);
  var crdrmax = d3.max([crmax, drmax]);

//  let xscale = d3.time.scale().range([0, width]).domain(chartExtent).nice();
  let xscale = mkXScale(chartExtent, [0, width]);
  let yscale = d3.scale.linear().range([0, height]).domain([0, crdrmax*2]);

  let crClass = 'cr' + chartName;
  let drClass = 'dr' + chartName;
  let lineClass = 'line' + chartName;

  // Credits in green above the axis.
  svg.selectAll('rect[class="' + crClass + '"]')
    .data(crs)
    .enter().append('rect')
      .attr('class', crClass)
      .style('fill', creditColour)
      .attr('x', d => xscale(d.x) + barWidth/2)
      .attr('y', d => yrange[0] + height/2 - yscale(d.y))
      .attr('height', d => yscale(d.y))
      .attr('width', barWidth);

  // Debits in red below the axis.
  svg.selectAll('rect[class="' + drClass + '"]')
    .data(drs)
    .enter().append('rect')
      .attr('class', drClass)
      .style('fill', debitColour)
      .attr('x', d => xscale(d.x) + barWidth/2)
      .attr('y', yrange[0] + height/2)
      .attr('height', d => yscale(d.y))
      .attr('width', barWidth);

  // Finally, draw a line showing balance.
  if (drawBalance) {
    _drawBalance(allTxns, svg, xscale, yscale, height, lineClass);
  }

  return {
    selectors: ['path[class="'+lineClass+'"]', 'rect[class="'+crClass+'"]', 'rect[class="'+drClass+'"]'],
    xscale: xscale
  };
}

function _drawBalance(txns, svg, xscale, yscale, height, lineClass) {
  var line = d3.svg.line()
    .x(d => xscale(d.date))
    .y(d => height/2 - yscale(d.balance));

  svg.append('path')
    .attr('class', lineClass)
    .attr('fill', 'none')
    .attr('stroke', 'white')
    .attr('stroke-width', '2')
  svg.select('path.' + lineClass).datum(txns);
  svg.select('path.' + lineClass).attr('d', line);
}

function maxTxnValue(txns) {
  let max = d3.max(txns.map(d=>d3.max(d, dd=>dd.y)));
  if (txns.length > 0 && max !== undefined) {
    return max;
  }
  // Fallthrough: [] and [Array[0]] get us here
  return 0;
}

// crs: [{date: txns: []}, ...]
// drs: [{date: txns: []}, ...]
// options:
//    - xrange
//    - yrange
//    - barWidth
//    - chartName
var stashme = {};
function drawStackedTxnHistory(crs, drs, svg, options) {
  let xrange = options.xrange || [0, 100]
    , yrange = options.yrange || [0, 100]
    , width = xrange[1] - xrange[0]
    , height = yrange[1] - yrange[0]
    , barWidth = options.barWidth || width / crs[0].length
    , chartName = options.chartName
    , crClass = 'cr' + chartName
    , drClass = 'dr' + chartName
    , allTxns = options.allTxns || []
    , crmax = maxTxnValue(crs)
    , drmax = maxTxnValue(drs)
    , timeExtent = options.allTxns?
        d3.extent(allTxns, d=>d.date) : d3.extent([].concat.apply([], drs.map(d => d.map(dd => dd.x))))
    , xscale = mkXScale(timeExtent, [0, width])
    , yscale = d3.scale.linear().domain([0, crmax+drmax]).range([0, height])
    , crlayers = d3.layout.stack()(crs)
    , drlayers = d3.layout.stack()(drs)
    , col = d3.scale.category20c()
    , crcols = idx => ['#3182bd', '#c6dbef', '#31a354', '#c7e9c0', '#00ff00'][idx]
    , drcols = idx => ['#e6550d', '#fdd0a2', '#756bb1', '#dadaeb', '#ff0000'][idx];

  if (options.crcol) {
    crcols = () => options.crcol;
  }

  if (options.drcol) {
    drcols = () => options.drcol;
  }

  let crLayerSel = svg.selectAll('.crlayers')
    .data(crlayers)
    .enter().append('g')
      .attr('class', 'crlayers')
      .style('fill', (d, idx) => crcols(idx));

  crLayerSel.selectAll('rect[class="' + crClass + '"]')
    .data(d => d)
    .enter().append('rect')
      .attr('class', crClass)
      .attr('x', d => xscale(d.x) + barWidth/2)
      .attr('y', d => yrange[0] + (height/2) - yscale(d.y0 + d.y))
      .attr('height', d => yscale(d.y))
      .attr('width', barWidth);

  let drLayerSel = svg.selectAll('.drlayers')
    .data(drlayers)
    .enter().append('g')
      .attr('class', 'drlayers')
      .style('fill', (d, idx) => drcols(idx));

  drLayerSel.selectAll('rect[class="' + drClass + '"]')
    .data(d => d)
    .enter().append('rect')
      .attr('class', drClass)
      .attr('x', d => xscale(d.x) + barWidth/2)
      .attr('y', d => yrange[0] + (height/2) + yscale(d.y0))
      .attr('height', d => yscale(d.y))
      .attr('width', barWidth);

  return ['.crlayers', '.drlayers'];
}

function assignDefaultValues(resultLst) {
  // Collect sets of the dates already in each result array
  let resultDates = resultLst.map(results => new Set(results.map(d=>d.x))) 
    // Collect the set of dates across all result arrays
    , allDates = [].concat.apply([], resultDates.map(rd => [...rd]))
    , allDatesSet = new Set(allDates);

  // Append missing all result arrays include an entry for all recordspp
  resultDates.forEach(function(resultSet, idx) {
    allDatesSet.forEach(function(d) {
      if (!resultSet.has(d)) {
        resultLst[idx].push({x: d, y: 0});
      }
    });
    resultLst[idx].sort((a, b) => a.x - b.x);
  });
}

function mkXScale(domain, range) {
  return d3.time.scale().domain(domain).range(range).nice(d3.time.month);
}

