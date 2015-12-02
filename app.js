/* 
  Module for retrive data from InfluxDB 0.9.x
  dependencies: d3js method d3.json
*/
function Influx(db, connection) {
  function prepareQueryUrl(query) {
    return self.connection + 'query?q=' + query + '&db=' + self.db;
  }

  if (!db) throw new Error('No InfluxDB database name (db)!');

  if (!connection) {
    if (window.location.host) {
      connection = window.location.protocol + '//' + window.location.host;  
    } else {
      connection = 'http://localhost'
    }
    connection += ':8086';
  }
  
  if (connection[connection.length - 1] != '/') {
    connection += '/'
  }
  
  var self = {
    connection: connection,
    db: db,
    query: function(query, callback) {
      /*
        Parameters: 
          query
          callback
      */
      var queryUrl = prepareQueryUrl(query);
      d3.json(queryUrl, function(error, data) {
          if (error) throw new Error(error);
          // data = data.results[0].series;
          if (data.results.length) data = data.results[0];
          callback(data);
      });      
    }
  };

  return self;
};

/*
  Function for prepare InfluxDB query
*/
function portQuery(ports, from, to, aggregate) {  
  
  var measurment = 'traffic';
  
  // values to retrive from Databse
  var values = {
    mean: ['rx_rate_mean', 'tx_rate_mean', 'drops_rate_mean']
  };
  
  // default aggregation function is mean
  if (!aggregate) {
    aggregate = 'mean';
  }

  if (!(aggregate in values)) throw new Error("Unsupported aggregate function " + aggregate);
  
  // calculate timegroup
  timegroup = '10m';
  timegroup = '10h';

  
  var result = '';
  result += ' SELECT ' + aggregate + '(' + values[aggregate].join('), ' + aggregate + '(') + ') ';
  result += ' FROM ' + measurment;
  result += ' WHERE time > ' + from;
  result += ' AND time < ' + to;
  result += ' AND (port = \'' + ports.join('\' OR port = \'') + '\')';
  result += ' GROUP BY time(' + timegroup + ')';
  
  return result;
}


function PortsCharts(container) {

    function convertHex(hex, opacity) {
        hex = hex.replace('#','');
        r = parseInt(hex.substring(0,2), 16);
        g = parseInt(hex.substring(2,4), 16);
        b = parseInt(hex.substring(4,6), 16);

        result = 'rgba('+r+','+g+','+b+','+opacity+')';
        return result;
    }
  
    var self = {
      init: function(container) {
          
          self.element = document.querySelector(container);
        
          console.log(container, self.element)
        
          self.width = self.element.offsetWidth;
          self.height = self.element.offsetHeight;
          
          self.x = d3.time.scale().range([0, self.width]);
          self.y = d3.scale.linear().range([self.height/2, 0]);

          self.rx = d3.svg.area()
              .interpolate("basis")
              .x(function(d) { return self.x(d[0]); })
              .y0(self.height/2)
              .y1(function(d) { return self.y(d[1]); });

          self.tx = d3.svg.area()
              .interpolate("basis")
              .x(function(d) { return self.x(d[0]); })
              .y0(self.height/2)
              .y1(function(d) { return self.y(-d[2]); });
        
          // clear
          d3.select(container).select('svg').remove();
        
          self.svg = d3.select(container).append("svg")
              .attr("width", self.width)
              .attr("height", self.height)
              .append("g");

      },
      isEmpty: function() {
        return !Boolean(d3.max(self.portData, function(d) { return d3.max([d[1],d[2]]); }));
      },
      microChart: function(data) {
        console.log('1----', data);

        if (!data) return;
        
        var portData = data.series[0].values;
        self.portData = portData;
        
        console.log('2----', portData);
        
        portData.forEach(function(d) {
          d[0] = new Date(d[0])
        });
        
        self.x.domain(d3.extent(portData, function(d) { return d[0]; }));

        self.y.domain([
          0,
          d3.max(portData, function(d) { return d3.max([d[1],d[2]]); })
        ]);

        var elem = self.svg.append("g").attr("class", "elem");

        // Draw RX
        elem.append("path")
          .attr("class", "area")
          .attr("d", function(d) { return self.rx(portData); })
          .attr("fill", convertHex(options.color, 0.4));

        // Draw TX
        elem.append("path")
          .attr("class", "area tx")
          .attr("d", function(d) { return self.tx(portData); })
          .attr("fill", convertHex(options.color, 0.4));

        // Draw errors
        self.svg.selectAll(".dot")
       .data(portData)
       .enter().append("circle")
       .attr("class", "dot")
       .attr("r", function(d) { return (d[2] + d[3])* self.height * (options.errorPower || 1); })
       .attr("cx", function(d) { return self.x(d[0]); })
       .attr("cy", self.height/2 );
        
      
      }
    };    
  
    self.init(container);
    return self;
  }

/* ----------------------------------------------------- */

var app = angular.module("app",['ngAnimate','ngRoute']);

app.controller("AppCtrl", function($rootScope, $window, $location, $filter, $http, $timeout) {

});

app.controller("aggregatorGraphicsCtrl", function($scope, $location, $route, $window) {
  
  var influx = new Influx('monitoring');
  var charts = []; 
  var chart, query;
  
  function getPorts() {
    var count = 2;
    var result = [], num;
    for(var i = 0; i < count; i++) {
      num = i + 1;
      result.push({
        num: num, 
        name: 'port' + num, 
        checked: false
      });
    }
    return result;
  }
  
  $scope.reload = function() {
    $window.location.reload();
  };
  
  $scope.microChart = function(port, event) {
      chart = new PortsCharts('.port-graph' + port.num);
      query = portQuery([port.name],'now() - 14d','now()','mean');
      
      influx.query(query, function(result) {
        chart.microChart(result);
      });
  };
  
  // Init
  $scope.ports = getPorts();
  
});





























/* Old Worked Code --------------------------------- */
function portHistoryGraph(options) {
  
    function prepareURL(q) {
      var u = 'http://localhost:8086/query?q=' + q;
      u += '&db=' + options.db;
      return u; 
    }

    function buildQuery() {
      var q = 'SELECT ';
      options.columns.forEach(function(i, index) {
        if (i.agg) {
          q += i.agg + '(' + i.name + ')';
        } else {
          q += name;
        }
        
        if (index < options.columns.length-1) q+= ', ';
      });
      q += ' FROM ' + options.measurment;
      q += ' WHERE time > now() - ' + options.last;
      q += ' AND port = \'' + options.port + '\'';
      q += ' GROUP BY time(' + options.timegroup + ')';
      return q;
    }
  
    function convertHex(hex, opacity) {
        hex = hex.replace('#','');
        r = parseInt(hex.substring(0,2), 16);
        g = parseInt(hex.substring(2,4), 16);
        b = parseInt(hex.substring(4,6), 16);

        result = 'rgba('+r+','+g+','+b+','+opacity+')';
        return result;
    }
  
    var self = {
      init: function(container) {
          
          self.element = document.querySelector(container);
        
          self.width = self.element.offsetWidth;
          self.height = self.element.offsetHeight;
          
          self.x = d3.time.scale().range([0, self.width]);
          self.y = d3.scale.linear().range([self.height/2, 0]);

          self.rx = d3.svg.area()
              .interpolate("basis")
              .x(function(d) { return self.x(d[0]); })
              .y0(self.height/2)
              .y1(function(d) { return self.y(d[1]); });

          self.tx = d3.svg.area()
              .interpolate("basis")
              .x(function(d) { return self.x(d[0]); })
              .y0(self.height/2)
              .y1(function(d) { return self.y(-d[2]); });
        
          // clear
          d3.select(container).select('svg').remove();
        
          self.svg = d3.select(container).append("svg")
              .attr("width", self.width)
              .attr("height", self.height)
              .append("g");


      },
      isEmpty: function() {
        return !Boolean(d3.max(self.portData, function(d) { return d3.max([d[1],d[2]]); }));
      },
      render: function(data) {

        if (!data.length) return;
        
        var portData = data[0].values;
            
        portData.forEach(function(d) {
          d[0] = new Date(d[0])
        });
        
        self.portData = portData;

        self.x.domain(d3.extent(portData, function(d) { return d[0]; }));

        self.y.domain([
          0,
          d3.max(portData, function(d) { return d3.max([d[1],d[2]]); })
        ]);

        var elem = self.svg.append("g")
          .attr("class", "elem");

        // Draw RX
        elem.append("path")
          .attr("class", "area")
          .attr("d", function(d) { return self.rx(portData); })
          .attr("fill", convertHex(options.color, 0.4));

        // Draw TX
        elem.append("path")
          .attr("class", "area tx")
          .attr("d", function(d) { return self.tx(portData); })
          .attr("fill", convertHex(options.color, 0.4));

        // Draw errors
        self.svg.selectAll(".dot")
       .data(portData)
       .enter().append("circle")
       .attr("class", "dot")
       .attr("r", function(d) { return (d[2] + d[3])* self.height * (options.errorPower || 1); })
       .attr("cx", function(d) { return self.x(d[0]); })
       .attr("cy", self.height/2 );
        
      
      }
    };    
  
    self.options = options;
    self.init(options.container);
    
    var q = prepareURL(buildQuery());
    console.log(q);
  
    d3.json(q, function(error, data) {
        console.log(data);
        graph = data.results[0].series;
        self.render(graph);
    });

    return self;
  }
  
  
/*  
  
// Init portColors
var portColors = d3.scale.category20();
var portNames = [];
for(var i = 0; i < 64; i++) {
  var num = i + 1;
  portNames.push('port' + num);
}
  
portColors.domain(portNames);  

  
// Toggle empty  
var showEmpty = true;
function toggleEmpty() {
  showEmpty = !showEmpty;
  
  portsM.forEach(function(m) {
    console.log(m.options.num, m.isEmpty() );
    var c = document.querySelector('.port-wrapper' + m.options.num);

    if (m.isEmpty() && !showEmpty) {
      c.style.display = 'none';
    } else {
      c.style.display = 'block';
    }
    
  });
}
  

var microcharts = document.querySelector('.ports-microcharts');

var portsM = [];

for(var i = 0; i < 64; i++) {
  var num = i + 1;

  // append div elements 

  var wrap = document.createElement("div");
  wrap.className = 'port-wrapper' + num + ' port-wrapper';
  
  var c1 = document.createElement("div");
  c1.className = 'port-name';
  c1.innerHTML = '<input type="checkbox" /> ' + num;
  
  var c = document.createElement("div");
  c.className = 'port-graph' + num + ' port-graph';

  wrap.appendChild(c1);
  wrap.appendChild(c);
  
  microcharts.appendChild(wrap);

  var m = new portHistoryGraph({
   db: 'monitoring',
   measurment: 'traffic',
   num: num,
   port: 'port' + num,
   columns: [
     {name: 'rx_rate_mean', agg: 'mean'},
     {name: 'tx_rate_mean', agg: 'mean'},
     {name: 'drops_rate_mean', agg: 'mean'}
   ],
   last: '14d', // 10 days
   timegroup: '1h',
   color: portColors('port' + num),
    
   errorPower: 0.1,
   container: '.port-graph' + num
 });
  
 portsM.push(m);
}
*/