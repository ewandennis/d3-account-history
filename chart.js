'use strict';

let sumTxns = (fld, sum, txn) => {
  let v = txn[fld];
  if (isNaN(v)) {
    return sum;
  }
  return sum + txn[fld];
};

let txnRollupFn = fld =>
  transactions => transactions.reduce(sumTxns.bind(null, fld), 0);

// Use parsed, conditioned data to generate charts
class AccountChart {
  constructor(model, domNode) {
    this.records = model.records;
    this.domNode = domNode;

    let nodeWidth = parseInt(window.getComputedStyle(domNode).width)
      , nodeHeight = parseInt(window.getComputedStyle(domNode).height);

    this.margin = {top: 30, right: 20, bottom: 20, left: 20};

    this.width = nodeWidth - this.margin.left - this.margin.right;
    this.height = nodeHeight - this.margin.top - this.margin.bottom;

    this.chartHeight = this.height * 0.65; 

    // inside margin, above chart
    this.searchResultsPos = -15;
    this.searchResultsHeight = 8;
    this.tickWidth = 3;
    this.tickColour = 'yellow';

    this.showLabels = false;
    this.lblPos = this.chartHeight - 50;
    this.lblSpacing = 25;

    this.sampleDescFldX = this.width / 3;
    this.sampleDescFldY = this.chartHeight - 50;

    this.debitColour = 'rgb(200, 0, 0)';
    this.creditColour = 'rgb(0, 200, 0)';

    this.showTxnSizes = false;
    this.txnHistoX = this.width/2 + this.margin.left;
    this.txnHistoY = this.height/2 + this.margin.bottom;
    this.txnHistoW = this.width / 3;
    this.txnHistoH = (this.height-this.margin.bottom) / 3;
    this.txnHistoColour = 'white';

    this.svg = d3.select('#' + this.domNode.id)
    .append('svg:svg')
      .attr('id', 'chart')
      .attr('version', '1.1')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('width', this.width+this.margin.left+this.margin.right)
      .attr('height', this.height+this.margin.top+this.margin.bottom)
    .append('g')
      .attr('transform', 'translate(' + this.margin.left + ', ' + this.margin.top + ')');

    // 1 element summary of credit and debit totals
    this.drs = this._rollup(this.records, 'dr');
    this.crs = this._rollup(this.records, 'cr');

    this.barWidth = (this.width/this.crs.length)-1;
  }

  _rollup(txns, fldname) {
    return d3.nest()
      .key(d => d3.time.month(d.date))
      .rollup(txnRollupFn(fldname))
      .entries(txns)
      .map(d => ({
      x: new Date(d.key),
      y: d.values
    }));
  }

  render() {
    let chartDetails = drawTxnHistory(this.crs, this.drs, this.svg, {
      xrange: [0, this.width],
      yrange: [0, this.chartHeight],
      barWidth: this.barWidth,
      allTxns: this.records,
      drawBalance: true,
      creditColour: this.creditColour,
      debitColour: this.debitColour,
      chartName: 'all'
    });

    let xaxis = d3.svg.axis()
      .scale(chartDetails.xscale)
      .ticks(d3.time.years, 1)
      .tickSubdivide(12)
      .tickSize(10);

    this.svg.append('g')
      .attr('class', 'axis')
      .attr('transform', 'translate(0, ' + (-this.margin.top) + ')')
      .call(xaxis);

    this.mkLabel('search', 0, this.lblPos + (1*this.lblSpacing));
    this.mkLabel('totalCr', 0, this.lblPos + (2*this.lblSpacing));
    this.mkLabel('totalDr', 0, this.lblPos + (3*this.lblSpacing));
    this.mkLabel('txnCount', 0, this.lblPos + (4*this.lblSpacing));

    this.mkLabel('sampleDescs', this.sampleDescFldX, this.sampleDescFldY);
  }

  mkLabel(id, x, y) {
    this.svg.append('text')
      .attr('id', id)
      .attr('font-family', 'Arial')
      .attr('fill', 'white')
      .attr('font-size', '20pt')
      .attr('x', x)
      .attr('y', y);
  }

  collectLikeDescs(txns) {
    let descs = new Set()
      , likeDescs = {}
      , condenseDesc = desc => desc.split(' ').slice(0, 2).join(' ');

    txns.forEach(txn => descs.add(condenseDesc(txn.desc)));

    for (let d of descs.keys()) {
      let likes = txns.filter(t => condenseDesc(t.desc) == d);
      likeDescs[d] = {
        cnt: likes.length,
        descs: [...new Set(likes.map(t => t.desc))].join('\n')
      }
    }

    return likeDescs;
  }

  searchAndRollup(query) {
    let re = new RegExp(query, 'i')
      , results  = this.records.filter(elt => re.test(elt.desc))
      , cr = this._rollup(results.filter(d => d.cr > 0), 'cr')
      , dr = this._rollup(results.filter(d => d.dr > 0), 'dr');

    return {
      cr: this._rollup(results.filter(d => d.cr > 0), 'cr'),
      dr: this._rollup(results.filter(d => d.dr > 0), 'dr'),
      results: results
    };
  }

  showSearchResults(query, colour) {
    let queries = query.split('|')
      /*
       * [
       *    {
       *      cr: [ {x: , y: }, ... ],
       *      dr: [ {x: , y: }, ... ]
       *    },
       *    ...
       * ]
       */
      , resultsLst = queries.map(q => this.searchAndRollup(q))
      // [ [{x: , y: }, ...], ... ]
      , crLst = resultsLst.map(res => res.cr)
      , drLst = resultsLst.map(res => res.dr);

    if (crLst.length === 0 || drLst.length === 0) {
      console.log('ugh, no results');
      return;
    }

    // Fill in entries in each result to ensure each layer is complete
    assignDefaultValues(crLst);
    assignDefaultValues(drLst);

    let selectors = drawStackedTxnHistory(crLst, drLst, this.svg, {
      xrange: [0, this.width],
      yrange: [this.height * 0.65, this.height * 0.85],
      drawBalance: false,
      barWidth: this.barWidth,
      allTxns: this.records,
      creditColour: this.creditColour,
      debitColour: this.debitColour,
      chartName: 'results'
    });

    function resultSummary(result, acc) {
      return {
        total: result.reduce((a, b) => a+acc(b), 0),
        mean: d3.mean(result, acc),
        median: d3.median(result, acc),
        variance: d3.variance(result, acc),
        stddev: d3.deviation(result, acc)
      };
    }

    let txnSummaries = resultsLst.map(txns => ({
      count: txns.results.length,
      crs: resultSummary(txns.results, r=>r.cr),
      drs: resultSummary(txns.results, r=>r.dr)
    }));

    let txnDescs = resultsLst.map(txns => this.collectLikeDescs(txns.results));
    
    // Barf a transction summary for each query
    queries.forEach(function(query, idx) {
      let summary = txnSummaries[idx]
        , descs = txnDescs[idx];
      console.log(query);
      console.log('\t# transactions  = ' + summary.count);
      console.log('\ttotal credits   = ' + summary.crs.total);
      console.log('\tmean credit     = ' + summary.crs.mean);
      console.log('\tmedian credit   = ' + summary.crs.median);
      console.log('\tcredit variance = ' + summary.crs.variance);
      console.log('\tcredit stddev   = ' + summary.crs.stddev);
      console.log('\ttotal debits    = ' + summary.drs.total);
      console.log('\tmean debit      = ' + summary.drs.mean);
      console.log('\tmedian debit    = ' + summary.drs.median);
      console.log('\tdebit variance  = ' + summary.drs.variance);
      console.log('\tdebit stddev    = ' + summary.drs.stddev);
      console.log('\tSample descriptions: ' + Object.keys(descs));
      console.log('\tFull descriptions: ' + Object.keys(descs).map(key=>descs[key].descs));
    });

    // Barf totals across all queries
    console.log('Totals');
    console.log('\t# transactions      = ' + txnSummaries.reduce((a, b)=>a+b.count, 0)); 
    console.log('\ttotal credits       = ' + txnSummaries.filter(txn=>txn.cr>0).length);
    console.log('\ttotal credit amount = ' + txnSummaries.reduce((a, b)=>a+b.crs.total, 0));
    console.log('\ttotal debits = ' + txnSummaries.filter(txn=>txn.dr>0).length);
    console.log('\ttotal debit amount = ' + txnSummaries.reduce((a, b)=>a+b.drs.total, 0));


    return {
      clear: this.clearSearchResults.bind(this, selectors)
    };
  }

  clearSearchResults(selectors) {
    selectors.forEach(sel => this.svg.selectAll(sel).remove());
    this.svg.select('#search').text('');
    this.svg.select('#txnCount').text('');
    this.svg.select('#totalCr').text('');
    this.svg.select('#totalDr').text('');
  }
}

