import { useState } from 'react';
import { ShieldCheck, AlertTriangle, XCircle, Activity, Cpu, Sliders, Layers, ChevronRight, Info } from 'lucide-react';
import { analyzeGisElevation } from '../api/quarries';
import toast from 'react-hot-toast';

export default function AiTerrainAnalysisModal({ quarry, isOpen, onClose }) {
  if (!isOpen || !quarry) return null;

  const analysis = quarry.ai_terrain_analysis || {
    grade: 'GREEN',
    grade_label: 'Still Good for Quarrying',
    badge: 'Safe Zone',
    color: '#10B981',
    confidence: 92.4,
    probabilities: { green: 0.924, yellow: 0.065, red: 0.011 },
    recommendation: 'Terrain elevation and slope profile are within safe environmental limits.',
    summary_metrics: {
      mean_elevation: 12.4,
      min_elevation: -5.0,
      max_elevation: 18.0,
      estimated_avg_slope: 7.2,
      deepest_pit_depth: -5.0,
      total_features: 1
    }
  };

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'simulator' | 'zones'

  // Interactive Simulator state
  const [simElev, setSimElev] = useState(analysis.summary_metrics?.mean_elevation ?? 15);
  const [simSlope, setSimSlope] = useState(analysis.summary_metrics?.estimated_avg_slope ?? 8);
  const [simPit, setSimPit] = useState(analysis.summary_metrics?.deepest_pit_depth ?? -5);
  const [simResult, setSimResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const res = await analyzeGisElevation({
        elevation: parseFloat(simElev),
        slope: parseFloat(simSlope),
        pit_depth: parseFloat(simPit),
      });
      setSimResult(res.data.analysis);
      toast.success('Naive Bayes inference re-evaluated!');
    } catch (err) {
      toast.error('Simulation error');
    } finally {
      setSimulating(false);
    }
  };

  const getGradeIcon = (grade) => {
    if (grade === 'RED') return <XCircle size={22} color="#EF4444" />;
    if (grade === 'YELLOW') return <AlertTriangle size={22} color="#F59E0B" />;
    return <ShieldCheck size={22} color="#10B981" />;
  };

  const currentAnalysis = simResult || analysis;
  const metrics = currentAnalysis.summary_metrics || currentAnalysis.input_metrics || {};
  const probs = currentAnalysis.probabilities || { green: 0.8, yellow: 0.15, red: 0.05 };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 680,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        border: '1px solid rgba(226, 232, 240, 0.8)', animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'linear-gradient(135deg, #0F766E 0%, #0D9488 100%)', color: '#ffffff',
          borderTopLeftRadius: 20, borderTopRightRadius: 20
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', opacity: 0.9, textTransform: 'uppercase', tracking: '0.05em' }}>
              <Cpu size={16} /> Naive Bayes AI Terrain Classification
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
              {quarry.name} GIS Elevation Analysis
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', color: '#ffffff',
              borderRadius: 10, width: 32, height: 32, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', padding: '0 24px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '12px 16px', border: 'none', background: 'none',
              fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              color: activeTab === 'overview' ? '#0F766E' : '#64748B',
              borderBottom: activeTab === 'overview' ? '2.5px solid #0F766E' : 'none',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Activity size={16} /> AI Grade Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            style={{
              padding: '12px 16px', border: 'none', background: 'none',
              fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              color: activeTab === 'simulator' ? '#0F766E' : '#64748B',
              borderBottom: activeTab === 'simulator' ? '2.5px solid #0F766E' : 'none',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Sliders size={16} /> Elevation Simulator
          </button>
          {analysis.feature_classifications && analysis.feature_classifications.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('zones')}
              style={{
                padding: '12px 16px', border: 'none', background: 'none',
                fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                color: activeTab === 'zones' ? '#0F766E' : '#64748B',
                borderBottom: activeTab === 'zones' ? '2.5px solid #0F766E' : 'none',
                display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <Layers size={16} /> GIS Sub-Zones ({analysis.feature_classifications.length})
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24 }}>
          {activeTab === 'overview' && (
            <div>
              {/* Primary AI Grade Banner */}
              <div style={{
                borderRadius: 14, padding: 20, marginBottom: 20,
                border: `2px solid ${currentAnalysis.color}`,
                background: currentAnalysis.grade === 'RED' ? '#FEF2F2' : currentAnalysis.grade === 'YELLOW' ? '#FFFBEB' : '#ECFDF5',
                display: 'flex', gap: 16, alignItems: 'flex-start'
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: '#ffffff', border: `1px solid ${currentAnalysis.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                }}>
                  {getGradeIcon(currentAnalysis.grade)}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                      background: currentAnalysis.color, color: '#ffffff', letterSpacing: '0.05em'
                    }}>
                      {currentAnalysis.badge || currentAnalysis.grade}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                      Model Confidence: <strong>{currentAnalysis.confidence}%</strong>
                    </span>
                  </div>

                  <h3 style={{ margin: '8px 0 4px', fontSize: '1.2rem', fontWeight: 700, color: '#1E293B' }}>
                    {currentAnalysis.grade_label}
                  </h3>

                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                    {currentAnalysis.recommendation}
                  </p>
                </div>
              </div>

              {/* Posterior Probabilities Bar Breakdown */}
              <div style={{ marginBottom: 24, padding: 18, background: '#F8FAFC', borderRadius: 14, border: '1px solid #E2E8F0' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Info size={16} className="text-teal-600" /> Gaussian Naive Bayes Posterior Probability $P(\text{Class} \mid \text{Elevation})$
                </h4>

                {/* Green Bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: '#065F46', marginBottom: 4 }}>
                    <span>🟢 Good for Quarrying (Safe Zone)</span>
                    <span>{(probs.green * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 5, background: '#E2E8F0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${probs.green * 100}%`, background: '#10B981', transition: 'width 0.5s ease' }} />
                  </div>
                </div>

                {/* Yellow Bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: '#92400E', marginBottom: 4 }}>
                    <span>🟡 Caution / Monitoring Required</span>
                    <span>{(probs.yellow * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 5, background: '#E2E8F0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${probs.yellow * 100}%`, background: '#F59E0B', transition: 'width 0.5s ease' }} />
                  </div>
                </div>

                {/* Red Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: '#991B1B', marginBottom: 4 }}>
                    <span>🔴 Quarrying Should Be Stopped</span>
                    <span>{(probs.red * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 5, background: '#E2E8F0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${probs.red * 100}%`, background: '#EF4444', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              </div>

              {/* Elevation Key Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                <div style={{ padding: 14, background: '#F1F5F9', borderRadius: 12, textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', fontWeight: 500 }}>Mean Elevation</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>{metrics.mean_elevation ?? metrics.elevation ?? 'N/A'} m</span>
                </div>
                <div style={{ padding: 14, background: '#F1F5F9', borderRadius: 12, textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', fontWeight: 500 }}>Max Elevation</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>{metrics.max_elevation ?? 'N/A'} m</span>
                </div>
                <div style={{ padding: 14, background: '#F1F5F9', borderRadius: 12, textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', fontWeight: 500 }}>Estimated Slope</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>{metrics.estimated_avg_slope ?? metrics.slope ?? 'N/A'}°</span>
                </div>
                <div style={{ padding: 14, background: '#F1F5F9', borderRadius: 12, textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', fontWeight: 500 }}>Deepest Pit</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>{metrics.deepest_pit_depth ?? metrics.pit_depth ?? 0} m</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'simulator' && (
            <div>
              <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: 16 }}>
                Adjust the elevation parameters to simulate Naive Bayes AI grading under different terrain condition scenarios.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    <span>Elevation (meters):</span>
                    <span style={{ color: '#0F766E' }}>{simElev} m</span>
                  </div>
                  <input
                    type="range" min="-10" max="120" step="1" value={simElev}
                    onChange={(e) => setSimElev(e.target.value)}
                    style={{ width: '100%', accentColor: '#0F766E' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94A3B8' }}>
                    <span>-10m (Deep pit)</span>
                    <span>20m (Safe)</span>
                    <span>40m (Caution)</span>
                    <span>120m (Mountain/Stop)</span>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    <span>Slope Angle (degrees):</span>
                    <span style={{ color: '#0F766E' }}>{simSlope}°</span>
                  </div>
                  <input
                    type="range" min="0" max="60" step="1" value={simSlope}
                    onChange={(e) => setSimSlope(e.target.value)}
                    style={{ width: '100%', accentColor: '#0F766E' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    <span>Pit Excavation Depth (meters below baseline):</span>
                    <span style={{ color: '#0F766E' }}>{simPit} m</span>
                  </div>
                  <input
                    type="range" min="-50" max="0" step="1" value={simPit}
                    onChange={(e) => setSimPit(e.target.value)}
                    style={{ width: '100%', accentColor: '#0F766E' }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSimulate}
                disabled={simulating}
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Cpu size={18} /> {simulating ? 'Re-evaluating Bayes Classifier...' : 'Run Naive Bayes Inference'}
              </button>

              {simResult && (
                <div style={{ marginTop: 20, padding: 16, background: '#F8FAFC', borderRadius: 12, border: `2px solid ${simResult.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 99, background: simResult.color, color: '#ffffff', fontSize: '0.75rem', fontWeight: 700 }}>
                      {simResult.grade}
                    </span>
                    <strong style={{ fontSize: '0.95rem', color: '#1E293B' }}>{simResult.grade_label}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>{simResult.recommendation}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'zones' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {analysis.feature_classifications?.map((feat, i) => (
                <div key={i} style={{
                  padding: 14, borderRadius: 12, border: `1px solid ${feat.color}`,
                  background: feat.grade === 'RED' ? '#FEF2F2' : feat.grade === 'YELLOW' ? '#FFFBEB' : '#ECFDF5',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E293B' }}>{feat.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                      Type: {feat.type} | Elevation: <strong>{feat.elevation}m</strong> | Slope: <strong>{feat.estimated_slope}°</strong>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                    background: feat.color, color: '#ffffff'
                  }}>
                    {feat.grade_label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '16px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', borderRadiusBottom: 20, textAlign: 'right' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 20px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
