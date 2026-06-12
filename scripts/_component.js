class Component extends DCLogic {
  state = {
    plotType: 'line', inputMode: 'enter', xAxisType: 'numeric',
    errorType: 'sem', violinInner: 'box',
    showPoints: false, barOutline: true, barWidth: 64,
    xTitle: 'Time (h)', yTitle: 'Response (a.u.)',
    yMin: '0', yMax: '100', yAuto: true, xLog: false, yLog: false, gridlines: false,
    plotTitle: '', legendPos: 'top-right',
    figW: '120', figH: '90', dpi: '300',
    groups: [
      { name: 'Control', color: '#0072B2', marker: 'circle', line: 'solid' },
      { name: 'Drug A', color: '#E69F00', marker: 'square', line: 'solid' },
      { name: 'Drug B', color: '#009E73', marker: 'triangle', line: 'dashed' },
    ],
    xLabels: ['0', '24', '48', '72', '96'],
    cells: [
      [['18', '20', '22'], ['32', '34', '36'], ['45', '47', '49'], ['52', '54', '56'], ['56', '58', '60']],
      [['20', '22', '24'], ['27', '29', '31'], ['35', '37', '39'], ['40', '42', '44'], ['43', '45', '47']],
      [['19', '21', '23'], ['44', '46', '48'], ['64', '66', '68'], ['76', '78', '80'], ['84', '86', '88']],
    ],
    replicates: 3,
    statsOpen: true, showSig: true, testFamily: 'parametric',
    compMode: 'allpairs', controlGroup: 0, correction: 'holm',
    sigDisplay: 'asterisks', compareAtEachX: false,
    // upload + interaction
    uploadShape: 'auto', uploadError: '', uploadInfo: '',
    manualPairs: [], _pendingSel: null,
  };

  PALETTE = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#D55E00', '#56B4E9', '#999999', '#000000'];

  set(patch) { this.setState(patch); }

  // ---- engine readiness: re-render once the bundled engine.js has loaded ----
  componentDidMount() { this._mounted = true; this._pollEngine(); }
  componentWillUnmount() { this._mounted = false; clearTimeout(this._pollT); }
  engine() { return (typeof window !== 'undefined') ? window.PlotterEngine : null; }
  _pollEngine() {
    if (!this._mounted) return;
    if (this.engine()) { this.forceUpdate(); return; }
    this._pollT = setTimeout(() => this._pollEngine(), 150);
  }

  setPlot(k) {
    this.setState(s => ({
      plotType: k,
      showPoints: k === 'bar' ? true : (k === 'line' ? false : s.showPoints),
      xAxisType: k === 'line' ? s.xAxisType : 'categorical',
    }));
  }

  // ---- grid handlers ----
  setCell(gi, xi, ri, v) { this.setState(s => { const c = s.cells.map(r => r.map(cell => cell.slice())); c[gi][xi][ri] = v; return { cells: c }; }); }
  setReplicates(n) {
    n = Math.max(1, Math.min(12, n || 1));
    this.setState(s => ({
      replicates: n,
      cells: s.cells.map(row => row.map(cell => { const a = cell.slice(0, n); while (a.length < n) a.push(''); return a; })),
    }));
  }
  cellVals(cell) {
    const raw = Array.isArray(cell) ? cell : String(cell).split(/[,\s]+/);
    return raw.map(v => String(v).trim()).filter(v => v !== '').map(Number).filter(x => !isNaN(x));
  }
  setXLabel(xi, v) { this.setState(s => { const x = s.xLabels.slice(); x[xi] = v; return { xLabels: x }; }); }
  setGroupName(gi, v) { this.setState(s => { const g = s.groups.map(o => ({ ...o })); g[gi].name = v; return { groups: g }; }); }
  setColor(gi, v) { this.setState(s => { const g = s.groups.map(o => ({ ...o })); g[gi].color = v; return { groups: g }; }); }
  setMarker(gi, v) { this.setState(s => { const g = s.groups.map(o => ({ ...o })); g[gi].marker = v; return { groups: g }; }); }
  setLine(gi, v) { this.setState(s => { const g = s.groups.map(o => ({ ...o })); g[gi].line = v; return { groups: g }; }); }
  addGroup() {
    this.setState(s => {
      const idx = s.groups.length;
      const row = s.xLabels.map(() => Array(s.replicates).fill(''));
      return {
        groups: [...s.groups, { name: 'Group ' + (idx + 1), color: this.PALETTE[idx % this.PALETTE.length], marker: 'circle', line: 'solid' }],
        cells: [...s.cells, row],
      };
    });
  }
  removeGroup(gi) { this.setState(s => s.groups.length <= 1 ? {} : ({ groups: s.groups.filter((_, i) => i !== gi), cells: s.cells.filter((_, i) => i !== gi), manualPairs: [] })); }
  addX() { this.setState(s => ({ xLabels: [...s.xLabels, String(s.xLabels.length)], cells: s.cells.map(r => [...r, Array(s.replicates).fill('')]) })); }
  removeX(xi) { this.setState(s => s.xLabels.length <= 1 ? {} : ({ xLabels: s.xLabels.filter((_, i) => i !== xi), cells: s.cells.map(r => r.filter((_, i) => i !== xi)) })); }

  // ---- upload ----
  onFile(e) {
    const input = e.target;
    const file = input.files && input.files[0];
    if (!file) return;
    const eng = this.engine();
    if (!eng) { this.set({ uploadError: 'Plotting engine still loading — please retry in a moment.' }); return; }
    const shape = this.state.uploadShape === 'auto' ? undefined : this.state.uploadShape;
    eng.parseFile(file, shape)
      .then(parsed => this.applyParsed(parsed, file.name))
      .catch(err => this.set({ uploadError: String((err && err.message) || err), uploadInfo: '' }));
    try { input.value = ''; } catch (_) {}
  }
  applyParsed(parsed, fname) {
    this.setState(s => {
      const groups = parsed.groupNames.map((name, i) => {
        const old = s.groups[i];
        return old ? { ...old, name } : { name, color: this.PALETTE[i % this.PALETTE.length], marker: 'circle', line: 'solid' };
      });
      let reps = 1;
      parsed.cells.forEach(row => row.forEach(c => { if (c.length > reps) reps = c.length; }));
      const extra = (parsed.warnings && parsed.warnings.length) ? (' ' + parsed.warnings.join(' ')) : '';
      return {
        groups,
        xLabels: parsed.xLabels.slice(),
        cells: parsed.cells.map(r => r.map(c => c.slice())),
        replicates: reps,
        manualPairs: [],
        uploadError: '',
        uploadInfo: 'Loaded ' + fname + ': ' + parsed.groupNames.length + ' group(s), ' + parsed.xLabels.length + ' X value(s), parsed as ' + parsed.shape.toUpperCase() + '.' + extra,
      };
    });
  }
  onTemplate(shape) {
    const eng = this.engine();
    if (!eng) { this.set({ uploadError: 'Plotting engine still loading.' }); return; }
    try { eng.downloadTemplate(shape); } catch (err) { this.set({ uploadError: String((err && err.message) || err) }); }
  }

  // ---- export ----
  onExportSvg() { const eng = this.engine(); if (eng && this._scene) eng.exportSvg(this._scene, this.state.plotTitle || 'plot'); }
  onExportPng() {
    const eng = this.engine();
    if (!eng || !this._scene) return;
    eng.exportPng(this._scene, {
      widthMm: parseFloat(this.state.figW) || 120,
      heightMm: parseFloat(this.state.figH) || 90,
      dpi: parseInt(this.state.dpi, 10) || 300,
      title: this.state.plotTitle || 'plot',
    }).catch(err => console.error('[plotter] PNG export failed:', err));
  }

  // ---- manual comparison selection (click legend entries in preview) ----
  pickSeries(idx) {
    this.setState(s => {
      const sel = s._pendingSel;
      if (sel == null) return { _pendingSel: idx };
      if (sel === idx) return { _pendingSel: null };
      const pair = [Math.min(sel, idx), Math.max(sel, idx)];
      const exists = (s.manualPairs || []).some(p => p[0] === pair[0] && p[1] === pair[1]);
      return { _pendingSel: null, manualPairs: exists ? s.manualPairs : [...(s.manualPairs || []), pair] };
    });
  }
  removePair(i) { this.setState(s => ({ manualPairs: (s.manualPairs || []).filter((_, j) => j !== i) })); }

  // ---- map state -> engine UiState ----
  uiState() {
    const S = this.state;
    return {
      plotType: S.plotType, errorType: S.errorType, xAxisType: S.xAxisType,
      groups: S.groups, xLabels: S.xLabels, cells: S.cells,
      yAuto: S.yAuto, yMin: S.yMin, yMax: S.yMax, yLog: S.yLog, xLog: S.xLog, gridlines: S.gridlines,
      plotTitle: S.plotTitle, legendPos: S.legendPos, barWidth: S.barWidth, barOutline: S.barOutline,
      violinInner: S.violinInner, showPoints: S.showPoints, xTitle: S.xTitle, yTitle: S.yTitle,
      showSig: S.showSig, testFamily: S.testFamily, compMode: S.compMode, controlGroup: Number(S.controlGroup) || 0,
      correction: S.correction, sigDisplay: S.sigDisplay, compareAtEachX: S.compareAtEachX,
      manualPairs: S.manualPairs || [],
    };
  }

  buildPlot() {
    const E = React.createElement;
    const eng = this.engine();
    this._warnings = [];
    if (!eng) {
      return E('div', { style: { padding: '48px 12px', textAlign: 'center', color: '#9aa3ad', fontSize: '13px' } }, 'Loading plotting engine…');
    }
    let result;
    try { result = eng.specFromState(this.uiState()); }
    catch (err) { return E('div', { style: { padding: '24px', color: '#b00020', fontSize: '13px', whiteSpace: 'pre-wrap' } }, 'Plot error: ' + String((err && err.message) || err)); }
    this._warnings = result.warnings || [];
    let scene;
    try { scene = eng.buildScene(result.spec); }
    catch (err) { return E('div', { style: { padding: '24px', color: '#b00020', fontSize: '13px' } }, 'Render error: ' + String((err && err.message) || err)); }
    this._scene = scene;

    const manual = this.state.compMode === 'manual' && this.state.showSig;
    const self = this;
    const decorate = (node) => {
      if (node.tag === 'svg') return { style: { display: 'block', width: '100%', height: 'auto', maxHeight: '74vh' } };
      if (manual && node.attrs && node.attrs['data-series-index'] != null) {
        const idx = Number(node.attrs['data-series-index']);
        return { onClick: () => self.pickSeries(idx), style: { cursor: 'pointer' } };
      }
      return null;
    };
    return eng.toReact(React, scene.root, undefined, decorate);
  }

  renderVals() {
    const S = this.state;
    const E = React.createElement;
    const plotTree = this.buildPlot();
    const warnings = this._warnings || [];

    const isLine = S.plotType === 'line', isBar = S.plotType === 'bar', isViolin = S.plotType === 'violin';

    const mkSeg = (active) => ({
      flex: 1, height: '30px', border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600,
      cursor: 'pointer', background: active ? '#ffffff' : 'transparent', color: active ? '#111827' : '#6b7280',
      boxShadow: active ? '0 1px 2px rgba(20,30,45,0.14)' : 'none', fontFamily: 'inherit', transition: 'all .12s',
    });
    const seg = (arr, cur, setter) => arr.map(o => ({ label: o.label, style: mkSeg(o.key === cur), onClick: () => setter(o.key) }));

    const mkTab = (active) => ({
      border: 'none', background: 'none', padding: '8px 4px', marginBottom: '-1px', fontSize: '13px', fontWeight: 600,
      cursor: 'pointer', color: active ? '#1f2733' : '#9aa3ad', borderBottom: active ? '2px solid #1f2733' : '2px solid transparent',
    });

    const sw = (on, toggle) => ({
      on, onClick: toggle,
      track: { width: '34px', height: '20px', borderRadius: '999px', background: on ? '#2563eb' : '#cbd2da', position: 'relative', cursor: 'pointer', transition: 'background .15s', flex: '0 0 auto' },
      knob: { position: 'absolute', top: '2px', left: on ? '16px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.25)', transition: 'left .15s' },
    });

    const f = (key, num) => (e) => this.set({ [key]: num ? +e.target.value : e.target.value });
    const gname = (i) => (S.groups[i] && S.groups[i].name) || ('Group ' + (i + 1));

    const grid = {
      xCols: S.xLabels.map((x, xi) => ({ label: x, onChange: e => this.setXLabel(xi, e.target.value), onRemove: () => this.removeX(xi) })),
      rows: S.groups.map((g, gi) => ({
        name: g.name, color: g.color,
        dotStyle: { width: '11px', height: '11px', borderRadius: '50%', background: g.color, flex: '0 0 auto', display: 'inline-block' },
        onName: e => this.setGroupName(gi, e.target.value),
        onRemove: () => this.removeGroup(gi),
        cells: (S.cells[gi] || []).map((arr, xi) => ({ reps: arr.map((v, ri) => ({ v, onChange: e => this.setCell(gi, xi, ri, e.target.value) })) })),
      })),
    };

    const series = S.groups.map((g, gi) => ({
      name: g.name, color: g.color, marker: g.marker, line: g.line,
      swatchStyle: { position: 'absolute', inset: 0, background: g.color, display: 'block' },
      onColor: e => this.setColor(gi, e.target.value),
      onName: e => this.setGroupName(gi, e.target.value),
      onMarker: e => this.setMarker(gi, e.target.value),
      onLine: e => this.setLine(gi, e.target.value),
    }));

    const mkRadioRow = () => ({
      display: 'flex', alignItems: 'center', gap: '9px', padding: '2px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
    });
    const mkRadio = (active) => ({
      width: '15px', height: '15px', borderRadius: '50%', flex: '0 0 auto',
      border: active ? '5px solid #2563eb' : '1.5px solid #c4cbd3', background: '#fff', transition: 'all .12s', boxSizing: 'border-box',
    });
    const compModeOpts = [
      { key: 'allpairs', label: 'All pairs' },
      { key: 'control', label: 'vs. control' },
      { key: 'manual', label: 'Manual (click in preview)' },
    ].map(o => ({ label: o.label, rowStyle: mkRadioRow(), radio: mkRadio(o.key === S.compMode), onClick: () => this.set({ compMode: o.key }) }));

    const statsChevron = {
      width: '8px', height: '8px', borderRight: '1.5px solid #6b7280', borderBottom: '1.5px solid #6b7280',
      transform: S.statsOpen ? 'rotate(45deg)' : 'rotate(-45deg)', transition: 'transform .15s', flex: '0 0 auto', marginLeft: '2px',
    };

    const manualPairs = S.manualPairs || [];
    const manualHint = (S._pendingSel != null)
      ? ('Selected "' + gname(S._pendingSel) + '". Click another series in the legend to pair.')
      : 'Click two series in the preview legend to add a bracket.';

    return {
      isLine, isBar, isViolin,
      isEnter: S.inputMode === 'enter', isUpload: S.inputMode === 'upload',
      errorAsRadio: isLine || isBar,
      showPointsAvail: isBar || isViolin,
      yManual: !S.yAuto,
      showYLog: isLine,
      showXLog: isLine && S.xAxisType === 'numeric',
      isControlMode: S.compMode === 'control',
      isManualMode: S.compMode === 'manual',
      statsOpen: S.statsOpen, showSig: S.showSig,

      plotTypeOpts: seg([{ key: 'line', label: 'Line' }, { key: 'bar', label: 'Bar' }, { key: 'violin', label: 'Violin' }], S.plotType, k => this.setPlot(k)),
      inputTabs: [{ key: 'enter', label: 'Enter data' }, { key: 'upload', label: 'Upload file' }].map(o => ({ label: o.label, style: mkTab(o.key === S.inputMode), onClick: () => this.set({ inputMode: o.key }) })),
      xTypeOpts: seg([{ key: 'numeric', label: 'Numeric' }, { key: 'categorical', label: 'Categorical' }], S.xAxisType, k => this.set({ xAxisType: k })),
      errorOpts: seg([{ key: 'sd', label: 'SD' }, { key: 'sem', label: 'SEM' }, { key: 'ci', label: '95% CI' }], S.errorType, k => this.set({ errorType: k })),
      violinInnerOpts: seg([{ key: 'box', label: 'Box' }, { key: 'meansd', label: 'Mean ± SD' }, { key: 'none', label: 'None' }], S.violinInner, k => this.set({ violinInner: k })),
      testFamilyOpts: seg([{ key: 'parametric', label: 't-test' }, { key: 'nonparam', label: 'Mann–Whitney' }], S.testFamily, k => this.set({ testFamily: k })),
      compModeOpts,
      sigDisplayOpts: seg([{ key: 'asterisks', label: 'Asterisks' }, { key: 'pvalue', label: 'Exact p' }, { key: 'ns', label: 'Show "ns"' }], S.sigDisplay, k => this.set({ sigDisplay: k })),
      groupOpts: S.groups.map((g, i) => ({ value: i, label: g.name })),

      swPoints: sw(S.showPoints, () => this.set({ showPoints: !S.showPoints })),
      swOutline: sw(S.barOutline, () => this.set({ barOutline: !S.barOutline })),
      swYAuto: sw(S.yAuto, () => this.set({ yAuto: !S.yAuto })),
      swYLog: sw(S.yLog, () => this.set({ yLog: !S.yLog })),
      swXLog: sw(S.xLog, () => this.set({ xLog: !S.xLog })),
      swGrid: sw(S.gridlines, () => this.set({ gridlines: !S.gridlines })),
      swSig: sw(S.showSig, () => this.set({ showSig: !S.showSig })),
      swEachX: sw(S.compareAtEachX, () => this.set({ compareAtEachX: !S.compareAtEachX })),

      grid, series,
      replicates: S.replicates,
      onReplicates: (e) => this.setReplicates(+e.target.value),
      onAddGroup: () => this.addGroup(),
      onAddX: () => this.addX(),

      // upload
      uploadShapeOpts: seg([{ key: 'auto', label: 'Auto' }, { key: 'long', label: 'Long' }, { key: 'wide', label: 'Wide' }], S.uploadShape, k => this.set({ uploadShape: k })),
      onFile: (e) => this.onFile(e),
      onTemplateLong: () => this.onTemplate('long'),
      onTemplateWide: () => this.onTemplate('wide'),
      uploadError: S.uploadError, uploadInfo: S.uploadInfo,

      barWidth: S.barWidth, onBarWidth: f('barWidth', true),

      xTitle: S.xTitle, yTitle: S.yTitle, yMin: S.yMin, yMax: S.yMax,
      onXTitle: f('xTitle'), onYTitle: f('yTitle'), onYMin: f('yMin'), onYMax: f('yMax'),
      plotTitle: S.plotTitle, onPlotTitle: f('plotTitle'),
      legendPos: S.legendPos, onLegendPos: f('legendPos'),

      figW: S.figW, figH: S.figH, dpi: S.dpi,
      onFigW: f('figW'), onFigH: f('figH'), onDpi: f('dpi'),
      onExportSvg: () => this.onExportSvg(),
      onExportPng: () => this.onExportPng(),

      onToggleStats: () => this.set({ statsOpen: !S.statsOpen }),
      statsChevron,
      controlGroup: S.controlGroup, onControlGroup: f('controlGroup', true),
      correction: S.correction, onCorrection: f('correction'),

      // manual comparisons
      manualHint,
      hasManualPairs: manualPairs.length > 0,
      manualPairRows: manualPairs.map((pr, i) => ({ label: gname(pr[0]) + ' vs ' + gname(pr[1]), onRemove: () => this.removePair(i) })),

      // warnings + plot
      plotWarnings: warnings,
      hasPlotWarnings: warnings.length > 0,
      plotSvg: plotTree,
    };
  }
}
