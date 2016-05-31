/*
 * Current Account explorer controller
 */

// Prepare conditioned records
// CSV fields: date, desc, cr, dr, balance
var model = new CSVModel('bankhistory.csv', (rec) => ({
      date: new Date(rec.date),
      cr: +rec.cr,
      dr: +rec.dr,
      balance: +rec.balance,
      desc: rec.desc
  }))
  , queryFldID = 'query1'
  , chart
  , searchState;

// Load dataset and init UI
model.loadP().then(mdl => {
  let chartFrame = document.getElementById('frame');
  chart = new AccountChart(model, chartFrame);
  chart.render();

  searchState = new SearchState(chart, queryFldID, 'rgb(255,255,0)');
  setupSearchFieldOnChange();
  simulateSearch('itunes|google', 0);

  setupSaveButton();

}).catch(err => { throw err });

function setupSaveButton() {
  document.getElementById('savebtn').innerHTML = makeSVGLink('chart');
}

function setupSearchFieldOnChange() {
  // Changing the search field triggers a search
  document.getElementById(queryFldID).addEventListener('change', function(evt) {
    var query = evt.target.value;
    searchState.search(query);
  });
}

function simulateSearch(query) {
  let fld = document.getElementById(queryFldID);
  fld.value = query;
  fld.dispatchEvent(new Event('change'));
}

class SearchState {
  constructor(chart, fieldSel, colour) {
    this.chart = chart;
    this.fieldSel = fieldSel;
    this.colour = colour;
    this.queryResults = null;
  }

  // Perform a search against the dataset
  // Show the results on the chart
  // Save the search state for cleanup before the next search
  search(query) {
    if (this.queryResults) {
      this.queryResults.clear();
      this.queryResults = null;
    }

    if (query.length > 0) {
      this.queryResults = this.chart.showSearchResults(query, this.colour);
    }
  }
}

