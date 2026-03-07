let dayHourData, hourlyData, dowData, yearlyData, minYear, maxYear;

const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

d3.csv('data/data.csv').then(function(raw) {
  console.log("csv loaded, rows:", raw.length);

  let parsed = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    const dt = new Date(row['Date']);

    // skip if date didn't parse right
    if (isNaN(dt.getTime())) continue;

    parsed.push({
      hour: dt.getHours(),
      dow: dt.getDay(),        // 0=Sunday in JS... need to convert
      year: parseInt(row['Year']),
      desc: row['Description']
    });
  }

  // JS getDay() returns 0=Sunday, but we want 0=Monday to match our days array
  // so convert: Sun(0)->6, Mon(1)->0, Tue(2)->1, etc
  for (let i = 0; i < parsed.length; i++) {
    const jsDay = parsed[i].dow;
    parsed[i].dow = jsDay === 0 ? 6 : jsDay - 1;
  }

  // console.log("parsed rows:", parsed.length);

  minYear = 9999;
  maxYear = 0;
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].year < minYear) minYear = parsed[i].year;
    if (parsed[i].year > maxYear) maxYear = parsed[i].year;
  }

  // key is "dayIndex-hour-subtype" -> count
  let dhAgg = {};
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    const key = p.dow + '-' + p.hour + '-' + p.desc;
    if (!dhAgg[key]) dhAgg[key] = { dayIndex: p.dow, hour: p.hour, subtype: p.desc, count: 0 };
    dhAgg[key].count++;
  }
  dayHourData = [];
  const dhKeys = Object.keys(dhAgg);
  for (let i = 0; i < dhKeys.length; i++) {
    dayHourData.push(dhAgg[dhKeys[i]]);
  }

  // hourly
  let hAgg = {};
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    const key = p.hour + '-' + p.desc;
    if (!hAgg[key]) hAgg[key] = { hour: p.hour, subtype: p.desc, count: 0 };
    hAgg[key].count++;
  }
  hourlyData = [];
  const hKeys = Object.keys(hAgg);
  for (let i = 0; i < hKeys.length; i++) {
    hourlyData.push(hAgg[hKeys[i]]);
  }

// dayly
  let dowAgg = {};
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    const key = p.dow + '-' + p.desc;
    if (!dowAgg[key]) dowAgg[key] = { dayIndex: p.dow, subtype: p.desc, count: 0 };
    dowAgg[key].count++;
  }
  dowData = [];
  const dowKeys = Object.keys(dowAgg);
  for (let i = 0; i < dowKeys.length; i++) {
    dowData.push(dowAgg[dowKeys[i]]);
  }

  // yearly 
  let yAgg = {};
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    const key = p.year + '-' + p.desc;
    if (!yAgg[key]) yAgg[key] = { year: p.year, subtype: p.desc, count: 0 };
    yAgg[key].count++;
  }
  yearlyData = [];
  const yKeys = Object.keys(yAgg);
  for (let i = 0; i < yKeys.length; i++) {
    yearlyData.push(yAgg[yKeys[i]]);
  }

  console.log("dayHourData rows:", dayHourData.length);

  initPage();

}).catch(function(err) {
  console.error("failed to load data:", err);
});

function initPage() {

  const yearLabelText = minYear + '\u2013' + maxYear;
  window.yearLabel = yearLabelText;

  console.log("page loaded, starting up");
  updateEverything();

  window.addEventListener('resize', function() {
    // console.log("window resized");
    updateEverything();
  });
}

let currentSubtype = 'ALL';
let hourRange = null;

function fmt(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function fmtHour(h) {
  if (h == 0) return '12 AM';
  if (h == 12) return '12 PM';
  if (h < 12) return h + ' AM';
  return (h - 12) + ' PM';
}

function filterData(data) {
  if (currentSubtype == 'ALL') return data;
  let result = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i].subtype == currentSubtype) {
      result.push(data[i]);
    }
  }
  return result;
}

// hover tooltip
const tooltipDiv = d3.select('#tooltip');

function showTooltip(event, html) {
  tooltipDiv.html(html).classed('visible', true);

  let left = event.clientX + 14;
  let top = event.clientY - 6;

  const rect = tooltipDiv.node().getBoundingClientRect();
  if (left + rect.width > window.innerWidth - 16) {
    left = event.clientX - rect.width - 14;
  }
  if (top + rect.height > window.innerHeight - 16) {
    top = event.clientY - rect.height + 6;
  }

  tooltipDiv.style('left', left + 'px').style('top', top + 'px');
}

function hideTooltip() {
  tooltipDiv.classed('visible', false);
}


const typeSelect = document.getElementById('burglary-type-select');
typeSelect.addEventListener('change', function() {
  currentSubtype = this.value;
  console.log("filter changed to:", currentSubtype);
  updateEverything();
});


// create update function like lab 4
function updateEverything() {
  updateStats();
  drawHeatmap();
  drawHourlyChart();
}


// stats table
function updateStats() {
  const filtered = filterData(hourlyData);

  let hourSums = {};
  for (let i = 0; i < filtered.length; i++) {
    const h = filtered[i].hour;
    if (!hourSums[h]) hourSums[h] = 0;
    hourSums[h] += filtered[i].count;
  }

  let peakHour = 0;
  let peakCount = 0;
  let safeHour = 0;
  let safeCount = 999999999;

  for (let h = 0; h < 24; h++) {
    const c = hourSums[h] || 0;
    if (c > peakCount) {
      peakCount = c;
      peakHour = h;
    }
    if (c < safeCount) {
      safeCount = c;
      safeHour = h;
    }
  }
  // console.log("peak:", fmtHour(peakHour), peakCount, "| safe:", fmtHour(safeHour), safeCount);

  const dowFiltered = filterData(dowData);
  let daySums = {};
  for (let i = 0; i < dowFiltered.length; i++) {
    const di = dowFiltered[i].dayIndex;
    if (!daySums[di]) daySums[di] = 0;
    daySums[di] += dowFiltered[i].count;
  }

  let worstDayIdx = 0;
  let worstDayCount = 0;
  for (let di = 0; di < 7; di++) {
    if ((daySums[di] || 0) > worstDayCount) {
      worstDayCount = daySums[di];
      worstDayIdx = di;
    }
  }

  const yearFiltered = filterData(yearlyData);
  let total = 0;
  for (let i = 0; i < yearFiltered.length; i++) {
    total += yearFiltered[i].count;
  }
  // console.log("total burglaries:", total);

  d3.select('#s-total').text(fmt(total));
  d3.select('#s-total-note').text(window.yearLabel);

  d3.select('#s-peak-hour').text(fmtHour(peakHour));
  d3.select('#s-peak-hour-note').text(fmt(peakCount) + ' incidents').attr('class', 'stat-item-note danger');

  d3.select('#s-safe-hour').text(fmtHour(safeHour));
  d3.select('#s-safe-hour-note').text(fmt(safeCount) + ' incidents').attr('class', 'stat-item-note safe');

  d3.select('#s-worst-day').text(days[worstDayIdx]);
  d3.select('#s-worst-day-note').text(fmt(worstDayCount) + ' total').attr('class', 'stat-item-note danger');
}


// heatap
function drawHeatmap() {
  const container = d3.select('#heatmap-chart');
  const containerWidth = container.node().getBoundingClientRect().width;

  const height = 310;
  const marginTop = 45;
  const marginRight = 20;
  const marginBottom = 50;
  const marginLeft = 75;
  const w = containerWidth - marginLeft - marginRight;
  const h = height - marginTop - marginBottom;

  container.html('');

  const svg = container.append('svg')
    .attr('width', containerWidth)
    .attr('height', height);

  const g = svg.append('g')
    .attr('transform', 'translate(' + marginLeft + ',' + marginTop + ')');

  const filtered = filterData(dayHourData);

  let agg = {};
  for (let i = 0; i < filtered.length; i++) {
    const d = filtered[i];
    if (!agg[d.dayIndex]) agg[d.dayIndex] = {};
    if (!agg[d.dayIndex][d.hour]) agg[d.dayIndex][d.hour] = 0;
    agg[d.dayIndex][d.hour] += d.count;
  }

  let maxVal = 0;
  for (let di = 0; di < 7; di++) {
    for (let hi = 0; hi < 24; hi++) {
      const val = (agg[di] && agg[di][hi]) ? agg[di][hi] : 0;
      if (val > maxVal) maxVal = val;
    }
  }

  const cellW = w / 24;
  const cellH = h / 7;

  const colorScale = d3.scaleSequential()
    .domain([0, maxVal])
    .interpolator(d3.interpolateRgb('#e8ecf2', '#003366'));

  for (let hr = 0; hr < 24; hr += 2) {
    g.append('text')
      .attr('x', hr * cellW + cellW / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-family', 'monospace')
      .style('font-size', '9px')
      .attr('fill', '#7a90a8')
      .text(fmtHour(hr));
  }

  for (let di = 0; di < 7; di++) {
    g.append('text')
      .attr('x', -10)
      .attr('y', di * cellH + cellH / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .style('font-size', '11px')
      .attr('fill', '#4a6080')
      .text(days[di]);
  }

  // cells
  for (let di = 0; di < 7; di++) {
    for (let hi = 0; hi < 24; hi++) {
      const val = (agg[di] && agg[di][hi]) ? agg[di][hi] : 0;

      let inRange = true;
      if (hourRange != null) {
        inRange = (hi >= hourRange[0] && hi <= hourRange[1]);
      }

      // took me forever to figure this out - need IIFE so the
      // loop vars don't get messed up in event handlers
      (function(dayIdx, hourIdx, value, isInRange) {
        g.append('rect')
          .attr('class', 'heatmap-cell')
          .attr('x', hourIdx * cellW + 1)
          .attr('y', dayIdx * cellH + 1)
          .attr('width', cellW - 2)
          .attr('height', cellH - 2)
          .attr('rx', 2)
          .attr('fill', colorScale(value))
          .attr('opacity', isInRange ? 1 : 0.2)
          .attr('stroke', 'none')
          .on('mousemove', function(event) {
            showTooltip(event,
              '<div class="tt-label">' + days[dayIdx] + ' \u00B7 ' + fmtHour(hourIdx) + '</div>' +
              '<div class="tt-value">' + value.toLocaleString() + '</div>'
            );
          })
          .on('mouseleave', function() {
            hideTooltip();
          });
      })(di, hi, val, inRange);
    }
  }

  g.append('text')
    .attr('x', w / 2)
    .attr('y', -22)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .attr('fill', '#1e3050')
    .text('Hour of Day');

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -h / 2)
    .attr('y', -55)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .attr('fill', '#1e3050')
    .text('Day of Week');
}


// 24h time curve chart
function drawHourlyChart() {
  const container = d3.select('#hourly-chart');
  const containerWidth = container.node().getBoundingClientRect().width;

  const height = 280;
  const marginTop = 16;
  const marginRight = 16;
  const marginBottom = 50;
  const marginLeft = 60;
  const w = containerWidth - marginLeft - marginRight;
  const h = height - marginTop - marginBottom;

  container.html('');

  const svg = container.append('svg')
    .attr('width', containerWidth)
    .attr('height', height);

  const g = svg.append('g')
    .attr('transform', 'translate(' + marginLeft + ',' + marginTop + ')');

  const filtered = filterData(hourlyData);
  let hourSums = {};
  for (let i = 0; i < filtered.length; i++) {
    const hr = filtered[i].hour;
    if (!hourSums[hr]) hourSums[hr] = 0;
    hourSums[hr] += filtered[i].count;
  }

  let hourArr = [];
  let maxCount = 0;
  for (let i = 0; i < 24; i++) {
    const c = hourSums[i] || 0;
    hourArr.push({ hour: i, count: c });
    if (c > maxCount) maxCount = c;
  }
  // console.log("hourly chart maxCount:", maxCount);

  const x = d3.scaleLinear().domain([0, 23]).range([0, w]);
  const y = d3.scaleLinear().domain([0, maxCount * 1.08]).range([h, 0]);

  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(4).tickSize(-w).tickFormat(''));

  const areaGen = d3.area()
    .x(function(d) { return x(d.hour); })
    .y0(h)
    .y1(function(d) { return y(d.count); })
    .curve(d3.curveCatmullRom);

  g.append('path')
    .datum(hourArr)
    .attr('d', areaGen)
    .attr('fill', '#003366')
    .attr('fill-opacity', 0.12);

  const lineGen = d3.line()
    .x(function(d) { return x(d.hour); })
    .y(function(d) { return y(d.count); })
    .curve(d3.curveCatmullRom);

  g.append('path')
    .datum(hourArr)
    .attr('d', lineGen)
    .attr('fill', 'none')
    .attr('stroke', '#003366')
    .attr('stroke-width', 2.5);

  for (let i = 0; i < hourArr.length; i++) {
    const d = hourArr[i];

    let dotColor = '#003366';
    if (hourRange != null) {
      if (d.hour < hourRange[0] || d.hour > hourRange[1]) {
        dotColor = '#7a90a8';
      }
    }

    // need the IIFE again for event handlers in loops :(
    (function(data, color) {
      g.append('circle')
        .attr('cx', x(data.hour))
        .attr('cy', y(data.count))
        .attr('r', 4)
        .attr('fill', color)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2)
        .on('mousemove', function(event) {
          showTooltip(event,
            '<div class="tt-label">' + fmtHour(data.hour) + '</div>' +
            '<div class="tt-value">' + fmt(data.count) + '</div>' +
            '<div class="tt-detail">burglaries at this hour</div>'
          );
        })
        .on('mouseleave', function() {
          hideTooltip();
        });
    })(d, dotColor);
  }

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', 'translate(0,' + h + ')')
    .call(d3.axisBottom(x).ticks(12).tickFormat(function(d) {
      if (d == 0) return '12 AM';
      if (d == 12) return '12 PM';
      if (d < 12) return d + ' AM';
      return (d - 12) + ' PM';
    }));

  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(4).tickFormat(function(d) { return fmt(d); }));

  g.append('text')
    .attr('x', w / 2)
    .attr('y', h + 40)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .attr('fill', '#1e3050')
    .text('Hour of Day');

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -h / 2)
    .attr('y', -45)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .attr('fill', '#1e3050')
    .text('Number of Burglaries');

  const brush = d3.brushX()
    .extent([[0, 0], [w, h]])
    .on('brush end', function(event) {
      if (!event.selection) {
        hourRange = null;
      } else {
        const x0 = x.invert(event.selection[0]);
        const x1 = x.invert(event.selection[1]);
        hourRange = [Math.round(x0), Math.round(x1)];
        console.log("brush range:", hourRange[0], "to", hourRange[1]);
      }
      drawHeatmap();
      updateStats();
    });

  g.append('g').attr('class', 'brush').call(brush);
}
