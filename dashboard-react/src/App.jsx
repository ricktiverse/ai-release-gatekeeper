import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_RESULTS_URL || 'http://localhost:3001';

// Color coding for risk levels
const getRiskColor = (risk) => {
  if (risk >= 0.75) return '#d32f2f'; // BLOCK - red
  if (risk >= 0.35) return '#f57c00'; // WARN - orange
  return '#388e3c'; // ALLOW - green
};

const getDecisionBgColor = (decision) => {
  if (decision === 'BLOCK') return '#ffebee';
  if (decision === 'WARN') return '#fff3e0';
  return '#e8f5e9';
};

const getDecisionBorderColor = (decision) => {
  if (decision === 'BLOCK') return '#d32f2f';
  if (decision === 'WARN') return '#f57c00';
  return '#388e3c';
};

// Color coding for suggestion codes
const getSuggestionCodeColor = (code) => {
  if (!code) return '#999';
  if (code.startsWith('BLOCK')) return '#d32f2f';     // Red
  if (code.startsWith('WARN')) return '#f57c00';      // Orange
  if (code.startsWith('ALLOW')) return '#388e3c';     // Green
  return '#1976d2';                                     // Blue (default)
};

const getSuggestionCodeBgColor = (code) => {
  if (!code) return '#f5f5f5';
  if (code.startsWith('BLOCK')) return '#ffebee';
  if (code.startsWith('WARN')) return '#fff3e0';
  if (code.startsWith('ALLOW')) return '#e8f5e9';
  return '#e3f2fd';
};

// Enhanced styling for suggestion code badges
const getSuggestionCodeBadgeStyle = (code) => {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '13px',
    fontFamily: 'monospace',
    border: '2px solid'
  };
  
  if (!code) return { ...baseStyle, backgroundColor: '#f5f5f5', color: '#999', borderColor: '#ddd' };
  if (code.startsWith('BLOCK')) return { ...baseStyle, backgroundColor: '#ffcdd2', color: '#b71c1c', borderColor: '#d32f2f', boxShadow: '0 2px 8px rgba(211, 47, 47, 0.15)' };
  if (code.startsWith('WARN')) return { ...baseStyle, backgroundColor: '#ffe0b2', color: '#e65100', borderColor: '#f57c00', boxShadow: '0 2px 8px rgba(245, 124, 0, 0.15)' };
  if (code.startsWith('ALLOW')) return { ...baseStyle, backgroundColor: '#c8e6c9', color: '#1b5e20', borderColor: '#388e3c', boxShadow: '0 2px 8px rgba(56, 142, 60, 0.15)' };
  return { ...baseStyle, backgroundColor: '#bbdefb', color: '#0d47a1', borderColor: '#1976d2', boxShadow: '0 2px 8px rgba(25, 118, 210, 0.15)' };
};

// Get icon for suggestion code
const getSuggestionCodeIcon = (code) => {
  if (!code) return '•';
  if (code.startsWith('BLOCK')) return '🛑';
  if (code.startsWith('WARN')) return '⚠️';
  if (code.startsWith('ALLOW')) return '✅';
  return '📋';
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString();
};

const getSuggestionCodeDescription = (code) => {
  const descriptions = {
    'BLOCK_CRITICAL_SECURITY': 'Immediate escalation required - critical security threat detected',
    'BLOCK_CREDENTIAL_EXPOSURE': 'Credentials exposed - immediate security action required',
    'BLOCK_DANGEROUS_EXEC': 'Dangerous code execution detected - manual review mandatory',
    'BLOCK_HIGH_SECURITY_RISK': 'High risk - requires manual review and escalation',
    'BLOCK_DANGEROUS_OPERATIONS': 'Dangerous operations detected - security review needed',
    'WARN_MODERATE_RISK_REVIEW': 'Moderate risk - additional code review and testing required',
    'WARN_BUILD_CONFIG_CHANGES': 'Build configuration changes - deployment review needed',
    'WARN_CONFIG_CHANGES_REVIEW': 'Configuration changes detected - audit and deployment review needed',
    'WARN_ENHANCED_TESTING_NEEDED': 'Enhanced testing requirements - additional test coverage recommended',
    'ALLOW_WITH_TESTING_REQUIRED': 'Approved - testing recommended before merge',
    'ALLOW_LOW_RISK_SAFE': 'Low risk - safe to merge'
  };
    // Add spelling warning description
    if (code === 'WARN_SPELLING_ERRORS') return 'Spelling mistakes detected in code or comments; please fix typos and documentation.';
  return descriptions[code] || 'Review suggested code';
};

// Analyzes PR for GROQ report insights
const generateGroqReport = (pr) => {
  const report = {
    threatLevel: pr.riskScore >= 0.75 ? 'CRITICAL' : pr.riskScore >= 0.35 ? 'ELEVATED' : 'LOW',
    securityIssues: [],
    codeQualityIssues: [],
    testCoverageGaps: [],
    recommendations: [],
    pattern: pr.suggestionCode || 'UNKNOWN'
  };

  // Detect security patterns
  if (pr.suggestionCode?.includes('CREDENTIAL')) {
    report.securityIssues.push('Sensitive credentials exposed in code');
  }
  if (pr.suggestionCode?.includes('DANGEROUS_EXEC')) {
    report.securityIssues.push('Dangerous code execution patterns detected');
  }
  if (pr.suggestionCode?.includes('BUILD_CONFIG')) {
    report.securityIssues.push('Critical build/deployment configuration changes');
  }

  // Analyze code quality
  if (pr.missingTests.length > 0) {
    report.testCoverageGaps.push(...pr.missingTests);
  }

  // Generate recommendations based on decision
  if (pr.decision === 'BLOCK') {
    report.recommendations.push('🛑 BLOCK: Do not merge - requires immediate action');
    report.recommendations.push('• Escalate to security team if CREDENTIAL_EXPOSURE detected');
    report.recommendations.push('• Address all security issues before proceeding');
  } else if (pr.decision === 'WARN') {
    report.recommendations.push('⚠️ WARN: Additional review required before merge');
    report.recommendations.push('• Complete all suggested tests');
    report.recommendations.push('• Have lead developer review the changes');
  } else {
    report.recommendations.push('✅ ALLOW: Approved for merge');
    report.recommendations.push('• Proceed with merge when ready');
    report.recommendations.push('• Consider additional testing for robustness');
  }

  return report;
};

export default function App() {
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPR, setExpandedPR] = useState(null);
  const [expandedAnalysis, setExpandedAnalysis] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    fetchPRs();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchPRs, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchPRs() {
    try {
      const resp = await axios.get(`${API_BASE}/results?ts=${Date.now()}`);
      const items = resp.data?.items || [];
      // Map to display shape with all detailed data
      const data = items.map((item, idx) => ({
        prNumber: item?.request?.prNumber || `temp-${Date.now()}-${idx}`,
        author: item?.request?.author || 'unknown',
        repository: item?.request?.repository || 'unknown',
        changedFiles: item?.request?.changedFiles || [],
        diff: item?.request?.diff || '',
        decision: item?.gatekeeper?.decision || 'UNKNOWN',
        riskScore: item?.gatekeeper?.riskScore ?? '-',
        riskLevel: item?.gatekeeper?.riskLevel || '-',
        prStatus: item?.gatekeeper?.prStatus || '-',
        summary: item?.gatekeeper?.summary || 'No summary',
        explanation: item?.gatekeeper?.explanation || '',
        missingTests: item?.gatekeeper?.missingTests || [],
        suggestedTests: item?.gatekeeper?.suggestedTests || [],
        suggestionCode: item?.gatekeeper?.suggestionCode || null,
        groqSuggestion: item?.gatekeeper?.groqSuggestion || null,
        spellingSuggestions: item?.gatekeeper?.spellingSuggestions || [],
        errorMessage: item?.gatekeeper?.errorMessage || null,
        analysisTimestamp: item?.gatekeeper?.analysisTimestamp || null,
        receivedAt: item?.receivedAt || ''
      }));
      // Detect simple code issues from diffs (client-side heuristics)
      data.forEach(d => {
        const issues = [];
        const s = (d.diff || '').toLowerCase();
        if (s.includes('password') || s.includes('passwd') || s.includes('secret') || s.includes('apikey') || s.includes('api_key')) issues.push('Possible credential exposure (password/secret/apikey)');
        if (s.includes('system.exit') || s.includes('runtime.getruntime') || s.includes('runtime.exec') || s.includes('exec(')) issues.push('Potential dangerous runtime/exec call');
        if (s.includes('console.log') || s.includes('print(')) issues.push('Debug prints found (console.log / print)');
        if (s.includes('todo') || s.includes('fixme')) issues.push('TODO/FIXME markers present');
        if (s.includes('sql') && s.includes('execute') || s.includes('concat(') && s.includes('sql')) issues.push('Potential SQL concatenation risk');
        d.codeIssues = issues;
      });
      // attach server-side spelling suggestions into code issues list for visibility
      data.forEach(d => {
        if (Array.isArray(d.spellingSuggestions) && d.spellingSuggestions.length > 0) {
          if (!d.codeIssues) d.codeIssues = [];
          d.spellingSuggestions.forEach(s => d.codeIssues.push(`Spelling suggestion: ${s}`));
        }
      });
      
      // Remove duplicates based on unique PR ID (repository + prNumber)
      const uniquePRs = [];
      const seenIds = new Set();
      data.forEach(pr => {
        const uniqueId = `${pr.repository}-${pr.prNumber}`;
        if (!seenIds.has(uniqueId)) {
          seenIds.add(uniqueId);
          uniquePRs.push(pr);
        }
      });
      
      setPrs(uniquePRs);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load results', err);
      setPrs([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{padding:20, fontSize:16}}>Loading PR analyses...</div>;

  return (
    <div style={{fontFamily:'Segoe UI, Arial, sans-serif', padding:20, backgroundColor:'#f5f5f5', minHeight:'100vh'}}>
      <div style={{maxWidth:1200, margin:'0 auto'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:30}}>
          <div>
            <h1 style={{color:'#1976d2', margin:'0 0 4px 0'}}>AI Gatekeeper - PR Code Review Dashboard</h1>
            <div style={{fontSize:12, color:'#666'}}>
              Last updated: {lastRefresh || 'loading...'} (auto-refresh every 5 seconds)
            </div>
          </div>
          <button 
            onClick={fetchPRs}
            style={{
              padding:'8px 16px',
              backgroundColor:'#1976d2',
              color:'white',
              border:'none',
              borderRadius:'4px',
              cursor:'pointer',
              fontWeight:'bold',
              fontSize:'12px'
            }}
          >
            🔄 Refresh Now
          </button>
        </div>
        
        {!Array.isArray(prs) || prs.length === 0 ? (
          <div style={{padding:20, backgroundColor:'white', borderRadius:4, boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
            <p style={{color:'#666'}}>No PR analyses available yet.</p>
          </div>
        ) : (
        <div>
          {prs.map((pr, idx) => (
            <div key={`${pr.repository}-${pr.prNumber}-${idx}`} style={{
              backgroundColor:'white',
              border:`3px solid ${getDecisionBorderColor(pr.decision)}`,
              borderRadius:8,
              marginBottom:20,
              boxShadow:'0 2px 8px rgba(0,0,0,0.1)',
              overflow:'hidden'
            }}>
              {/* Header Section */}
              <div style={{
                padding:16,
                backgroundColor:getDecisionBgColor(pr.decision),
                borderBottom:`1px solid ${getDecisionBorderColor(pr.decision)}`,
                display:'flex',
                justifyContent:'space-between',
                alignItems:'center',
                cursor:'pointer'
              }} onClick={() => setExpandedPR(expandedPR === idx ? null : idx)}>
                <div style={{flex:1}}>
                  <h2 style={{margin:'0 0 8px 0', color:'#1a237e'}}>
                    {pr.repository} <span style={{color:'#666', fontSize:'0.9em'}}>#{pr.prNumber}</span>
                  </h2>
                  <div style={{color:'#555', fontSize:13}}>
                    By <strong>{pr.author}</strong> {pr.receivedAt && `on ${new Date(pr.receivedAt).toLocaleDateString()}`}
                  </div>
                  
                  {/* Enhanced Suggestion Code Badge in Header */}
                  {pr.suggestionCode && (
                    <div style={{marginTop:12}}>
                      <div style={getSuggestionCodeBadgeStyle(pr.suggestionCode)}>
                        {getSuggestionCodeIcon(pr.suggestionCode)}
                        <span>{pr.suggestionCode}</span>
                      </div>
                      <div style={{marginTop:6, fontSize:12, color:'#666', lineHeight:'1.5'}}>
                        {getSuggestionCodeDescription(pr.suggestionCode)}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Decision Badge with Risk Level */}
                <div style={{
                  display:'flex',
                  flexDirection:'column',
                  gap:8,
                  alignItems:'flex-end',
                  marginLeft:16
                }}>
                  <div style={{
                    padding:'10px 16px',
                    backgroundColor:getRiskColor(pr.riskScore),
                    color:'white',
                    borderRadius:20,
                    fontWeight:'bold',
                    textAlign:'center',
                    minWidth:100,
                    fontSize:14,
                    boxShadow:`0 2px 6px ${getRiskColor(pr.riskScore)}40`
                  }}>
                    {pr.decision}
                  </div>
                  <div style={{fontSize:11, color:'#555', textAlign:'right', lineHeight:'1.5'}}>
                    Risk: <strong>{(pr.riskScore * 100).toFixed(1)}%</strong><br/>
                    Level: <strong style={{color:getRiskColor(pr.riskScore)}}>{pr.riskLevel || '-'}</strong>
                  </div>
                </div>
              </div>

              {/* Summary Section */}
              <div style={{padding:16, borderBottom:'1px solid #eee'}}>
                <div style={{marginBottom:12}}>
                  <strong style={{color:'#1a237e', fontSize:14}}>Analysis Summary:</strong>
                  <p style={{margin:'8px 0 0 0', color:'#444', lineHeight:1.5}}>{pr.summary}</p>
                </div>
                <div style={{marginBottom:12}}>
                  <strong style={{color:'#1a237e', fontSize:14}}>Assessment:</strong>
                  <p style={{margin:'8px 0 0 0', color:'#555', fontStyle:'italic', lineHeight:1.5}}>{pr.explanation}</p>
                </div>
                
                {/* PR Status Section */}
                {pr.prStatus && (
                  <div style={{marginBottom:12, padding:12, backgroundColor:'#f5f5f5', borderRadius:4, border:`1px solid ${getDecisionBorderColor(pr.decision)}`}}>
                    <strong style={{color:'#1a237e', fontSize:14}}>📋 PR Status:</strong>
                    <p style={{margin:'8px 0 0 0', color:'#333', fontSize:13, lineHeight:1.6}}>{pr.prStatus}</p>
                  </div>
                )}
                
                {/* Metadata Row */}
                  {/* PR Description/Diff Preview with Suggestion Code */}
                  {(pr.diff || pr.changedFiles?.length > 0) && (
                    <div style={{marginBottom:12, marginTop:16, borderRadius:6, overflow:'hidden', border:`2px solid ${getDecisionBorderColor(pr.decision)}`}}>
                      {/* Header with Suggestion Code */}
                      <div style={{
                        backgroundColor:getDecisionBgColor(pr.decision),
                        padding:'14px 16px',
                        borderBottom:`2px solid ${getDecisionBorderColor(pr.decision)}`,
                        display:'flex',
                        justifyContent:'space-between',
                        alignItems:'center'
                      }}>
                        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                          <span style={{fontSize:18}}>📝</span>
                          <strong style={{color:'#1a237e', fontSize:14, textTransform:'uppercase', letterSpacing:'0.5px'}}>
                            PR Description & Changes
                          </strong>
                        </div>
                        {pr.suggestionCode && (
                          <div style={{...getSuggestionCodeBadgeStyle(pr.suggestionCode), fontSize:'11px', padding:'6px 10px'}}>
                            {getSuggestionCodeIcon(pr.suggestionCode)} {pr.suggestionCode}
                          </div>
                        )}
                      </div>
                    
                      {/* Changed Files List */}
                      {pr.changedFiles && pr.changedFiles.length > 0 && (
                        <div style={{padding:'12px 16px', borderBottom:'1px solid #e0e0e0', backgroundColor:'#fafafa'}}>
                          <div style={{fontSize:12, fontWeight:'bold', color:'#1a237e', marginBottom:8}}>
                            📂 Changed Files ({pr.changedFiles.length}):
                          </div>
                          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8}}>
                            {pr.changedFiles.map((file, fidx) => (
                              <div key={fidx} style={{
                                padding:'6px 10px',
                                backgroundColor:'white',
                                borderRadius:4,
                                border:'1px solid #ddd',
                                fontSize:11,
                                fontFamily:'monospace',
                                color:'#333',
                                overflow:'hidden',
                                textOverflow:'ellipsis',
                                whiteSpace:'nowrap'
                              }} title={file}>
                                {file}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    
                      {/* Diff Preview */}
                      {pr.diff && pr.diff.length > 0 && (
                        <div style={{
                          padding:'12px 16px',
                          backgroundColor:'white',
                          maxHeight:'300px',
                          overflowY:'auto',
                          fontFamily:'monospace',
                          fontSize:'11px',
                          lineHeight:'1.4',
                          color:'#333'
                        }}>
                          <div style={{fontWeight:'bold', color:'#1a237e', marginBottom:8, fontSize:'12px'}}>
                            📄 Diff Preview:
                          </div>
                          {pr.diff.split('\n').slice(0, 30).map((line, lidx) => {
                            const isAddition = line.startsWith('+') && !line.startsWith('+++');
                            const isDeletion = line.startsWith('-') && !line.startsWith('---');
                            return (
                              <div key={lidx} style={{
                                color: isAddition ? '#2e7d32' : isDeletion ? '#c62828' : '#333',
                                backgroundColor: isAddition ? '#f1f8e9' : isDeletion ? '#ffebee' : 'transparent',
                                padding:'2px 4px',
                                marginBottom:'1px'
                              }}>
                                {line}
                              </div>
                            );
                          })}
                          {pr.diff.split('\n').length > 30 && (
                            <div style={{
                              marginTop:8,
                              padding:'6px 8px',
                              backgroundColor:'#e3f2fd',
                              borderRadius:3,
                              fontSize:'10px',
                              color:'#1565c0',
                              fontStyle:'italic'
                            }}>
                              ... and {pr.diff.split('\n').length - 30} more lines
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                
                  {/* Metadata Row */}
                  <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:16, fontSize:12, marginTop:12, paddingTop:12, borderTop:'1px solid #eee'}}>
                  {/* Suggestion Code Card */}
                  {pr.suggestionCode && (
                    <div style={{
                      padding:12,
                      backgroundColor:getSuggestionCodeBgColor(pr.suggestionCode),
                      borderRadius:6,
                      border:`2px solid ${getSuggestionCodeColor(pr.suggestionCode)}`
                    }}>
                      <div style={{
                        fontWeight:'bold',
                        color:getSuggestionCodeColor(pr.suggestionCode),
                        marginBottom:8,
                        fontSize:13,
                        textTransform:'uppercase',
                        letterSpacing:'0.5px'
                      }}>
                        {getSuggestionCodeIcon(pr.suggestionCode)} Action Code
                      </div>
                      <div style={{
                        padding:'8px 10px',
                        backgroundColor:'white',
                        borderRadius:4,
                        border:`1px solid ${getSuggestionCodeColor(pr.suggestionCode)}`,
                        fontWeight:'bold',
                        fontFamily:'monospace',
                        fontSize:12,
                        color:getSuggestionCodeColor(pr.suggestionCode),
                        marginBottom:8,
                        textAlign:'center'
                      }}>
                        {pr.suggestionCode}
                      </div>
                      <div style={{color:'#555', fontSize:11, lineHeight:'1.5'}}>
                        {getSuggestionCodeDescription(pr.suggestionCode)}
                      </div>
                      {/* GROQ-provided concise suggestion (if present) */}
                      {pr.groqSuggestion && (
                        <div style={{marginTop:10, padding:10, backgroundColor:'white', borderRadius:4, border:'1px solid #4caf50', color:'#2e7d32', fontSize:11, lineHeight:'1.5'}}>
                          <strong style={{color:'#1b5e20'}}>💡 GROQ Suggestion:</strong> {pr.groqSuggestion}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Analysis Timestamp */}
                  {pr.analysisTimestamp && (
                    <div style={{
                      padding:12,
                      backgroundColor:'#f5f5f5',
                      borderRadius:6,
                      border:'1px solid #ddd'
                    }}>
                      <div style={{
                        fontWeight:'bold',
                        color:'#1a237e',
                        marginBottom:8,
                        fontSize:13,
                        textTransform:'uppercase',
                        letterSpacing:'0.5px'
                      }}>
                        ⏱️ Analyzed
                      </div>
                      <div style={{color:'#555', fontSize:12, lineHeight:'1.5'}}>
                        {formatTimestamp(pr.analysisTimestamp)}
                      </div>
                    </div>
                  )}
                  
                  {/* Risk Summary */}
                  <div style={{
                    padding:12,
                    backgroundColor:getDecisionBgColor(pr.decision),
                    borderRadius:6,
                    border:`2px solid ${getDecisionBorderColor(pr.decision)}`
                  }}>
                    <div style={{
                      fontWeight:'bold',
                      color:getDecisionBorderColor(pr.decision),
                      marginBottom:8,
                      fontSize:13,
                      textTransform:'uppercase',
                      letterSpacing:'0.5px'
                    }}>
                      📊 Risk Summary
                    </div>
                    <div style={{color:'#444', fontSize:12, lineHeight:'1.6'}}>
                      <div>Score: <strong>{(pr.riskScore * 100).toFixed(1)}%</strong></div>
                      <div>Level: <strong style={{color:getRiskColor(pr.riskScore)}}>{pr.riskLevel}</strong></div>
                      <div>Decision: <strong>{pr.decision}</strong></div>
                    </div>
                  </div>
                  
                  {/* Error Message */}
                  {pr.errorMessage && (
                    <div style={{gridColumn:'1 / -1', padding:12, backgroundColor:'#ffebee', borderRadius:6, border:'2px solid #ef5350', color:'#c62828'}}>
                      <strong style={{fontSize:13}}>⚠ Error:</strong>
                      <div style={{marginTop:6, fontSize:11}}>{pr.errorMessage}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Expandable Details */}
              {expandedPR === idx && (
                <div style={{padding:16, backgroundColor:'#fafafa', borderTop:'1px solid #eee'}}>
                  
                  {/* GROQ Analysis Report Section - Always Expanded by Default */}
                  <div style={{marginBottom:20, padding:14, backgroundColor:'white', borderRadius:6, border:'3px solid #1976d2', boxShadow:'0 2px 6px rgba(25, 118, 210, 0.2)'}}>
                    <div style={{
                      display:'flex',
                      justifyContent:'space-between',
                      alignItems:'center',
                      cursor:'pointer',
                      padding:'8px 0',
                      marginBottom:12
                    }} onClick={() => setExpandedAnalysis(expandedAnalysis === idx ? null : idx)}>
                      <h3 style={{color:'#1976d2', fontSize:16, margin:0, fontWeight:'bold'}}>
                        🤖 GROQ AI Analysis Report
                      </h3>
                      <span style={{fontSize:14, color:'#1976d2', fontWeight:'bold', transition:'transform 0.3s'}}>
                        {expandedAnalysis === idx ? '−' : '+'}
                      </span>
                    </div>

                    {expandedAnalysis !== idx && (
                      <div style={{fontSize:12, color:'#1976d2', fontStyle:'italic'}}>
                        Click to expand detailed AI analysis report
                      </div>
                    )}

                    {(expandedAnalysis === idx || expandedAnalysis === null) && (() => {
                      const report = generateGroqReport(pr);
                      return (
                        <div style={{marginTop:12, paddingTop:12, borderTop:'1px solid #e0e0e0'}}>
                          {/* Suggestion Code Pattern Box */}
                          {pr.suggestionCode && (
                            <div style={{
                              marginBottom:16,
                              padding:14,
                              backgroundColor: pr.decision === 'BLOCK' ? '#ffcdd2' : pr.decision === 'WARN' ? '#ffe0b2' : '#c8e6c9',
                              borderRadius:8,
                              border: `3px solid ${pr.decision === 'BLOCK' ? '#d32f2f' : pr.decision === 'WARN' ? '#f57c00' : '#388e3c'}`,
                              boxShadow: `0 4px 12px ${pr.decision === 'BLOCK' ? 'rgba(211, 47, 47, 0.2)' : pr.decision === 'WARN' ? 'rgba(245, 124, 0, 0.2)' : 'rgba(56, 142, 60, 0.2)'}`
                            }}>
                              <div style={{
                                fontWeight:'bold',
                                fontSize:14,
                                marginBottom:10,
                                color: pr.decision === 'BLOCK' ? '#b71c1c' : pr.decision === 'WARN' ? '#e65100' : '#1b5e20',
                                textTransform:'uppercase',
                                letterSpacing:'1px'
                              }}>
                                {getSuggestionCodeIcon(pr.suggestionCode)} Suggestion Code Pattern
                              </div>
                              <div style={{
                                padding:'12px 14px',
                                backgroundColor:'white',
                                borderRadius:6,
                                border: `2px solid ${pr.decision === 'BLOCK' ? '#d32f2f' : pr.decision === 'WARN' ? '#f57c00' : '#388e3c'}`,
                                fontFamily:'monospace',
                                fontSize:14,
                                fontWeight:'bold',
                                color: pr.decision === 'BLOCK' ? '#b71c1c' : pr.decision === 'WARN' ? '#e65100' : '#1b5e20',
                                textAlign:'center',
                                marginBottom:10
                              }}>
                                {pr.suggestionCode}
                              </div>
                              <div style={{
                                color: pr.decision === 'BLOCK' ? '#c62828' : pr.decision === 'WARN' ? '#e64a19' : '#2e7d32',
                                fontSize:12,
                                lineHeight:'1.6'
                              }}>
                                {getSuggestionCodeDescription(pr.suggestionCode)}
                              </div>
                            </div>
                          )}

                          {/* Threat Level Indicator */}
                          <div style={{marginBottom:14, padding:12, borderRadius:6, backgroundColor: report.threatLevel === 'CRITICAL' ? '#ffcdd2' : report.threatLevel === 'ELEVATED' ? '#ffe0b2' : '#c8e6c9', border: `2px solid ${report.threatLevel === 'CRITICAL' ? '#d32f2f' : report.threatLevel === 'ELEVATED' ? '#f57c00' : '#388e3c'}`}}>
                            <div style={{fontWeight:'bold', fontSize:13, color: report.threatLevel === 'CRITICAL' ? '#b71c1c' : report.threatLevel === 'ELEVATED' ? '#e65100' : '#1b5e20', marginBottom:6}}>
                              THREAT LEVEL: {report.threatLevel}
                            </div>
                            <div style={{fontSize:12, color: report.threatLevel === 'CRITICAL' ? '#c62828' : report.threatLevel === 'ELEVATED' ? '#e64a19' : '#2e7d32'}}>
                              Risk Score: <strong>{(pr.riskScore * 100).toFixed(1)}%</strong>
                            </div>
                          </div>

                          {/* Pattern Analysis */}
                          <div style={{marginBottom:14}}>
                            <div style={{fontWeight:'bold', color:'#1a237e', marginBottom:6, fontSize:12, textTransform:'uppercase', letterSpacing:'0.5px'}}>
                              📍 Detection Pattern:
                            </div>
                            <div style={{
                              padding:10,
                              backgroundColor:'#e3f2fd',
                              borderRadius:4,
                              border:'2px solid #2196f3',
                              fontFamily:'monospace',
                              fontSize:12,
                              fontWeight:'bold',
                              color:'#0d47a1',
                              wordBreak:'break-all'
                            }}>
                              {report.pattern}
                            </div>
                            <div style={{fontSize:11, color:'#555', marginTop:6, lineHeight:'1.4'}}>
                              {getSuggestionCodeDescription(report.pattern)}
                            </div>
                          </div>

                          {/* Security Issues */}
                          {report.securityIssues.length > 0 && (
                            <div style={{marginBottom:14}}>
                              <div style={{fontWeight:'bold', color:'#d32f2f', marginBottom:8, fontSize:12, textTransform:'uppercase', letterSpacing:'0.5px'}}>
                                🔒 Security Issues ({report.securityIssues.length}):
                              </div>
                              <div style={{backgroundColor:'#ffebee', padding:10, borderRadius:4, border:'2px solid #ef5350'}}>
                                {report.securityIssues.map((issue, i) => (
                                  <div key={i} style={{color:'#c62828', fontSize:11, marginBottom:i < report.securityIssues.length - 1 ? 6 : 0, lineHeight:'1.4'}}>
                                    🚨 {issue}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Test Coverage Gaps */}
                          {report.testCoverageGaps.length > 0 && (
                            <div style={{marginBottom:14}}>
                              <div style={{fontWeight:'bold', color:'#f57c00', marginBottom:8, fontSize:12, textTransform:'uppercase', letterSpacing:'0.5px'}}>
                                ⚠️ Test Coverage Gaps ({report.testCoverageGaps.length}):
                              </div>
                              <div style={{backgroundColor:'#fff3e0', padding:10, borderRadius:4, border:'2px solid #ffb74d'}}>
                                {report.testCoverageGaps.map((gap, i) => (
                                  <div key={i} style={{color:'#e65100', fontSize:11, marginBottom:i < report.testCoverageGaps.length - 1 ? 6 : 0, lineHeight:'1.4'}}>
                                    📋 {gap}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Recommendations */}
                          <div style={{marginBottom:0}}>
                            <div style={{fontWeight:'bold', color:'#1976d2', marginBottom:8, fontSize:12, textTransform:'uppercase', letterSpacing:'0.5px'}}>
                              💡 Recommendations:
                            </div>
                            <div style={{backgroundColor:'#e3f2fd', padding:10, borderRadius:4, border:'2px solid #64b5f6'}}>
                              {report.recommendations.map((rec, i) => (
                                <div key={i} style={{
                                  color:rec.includes('BLOCK') ? '#d32f2f' : rec.includes('WARN') ? '#f57c00' : '#1565c0',
                                  fontSize:11,
                                  marginBottom:i < report.recommendations.length - 1 ? 8 : 0,
                                  fontWeight: rec.includes('BLOCK') || rec.includes('ALLOW') ? 'bold' : 'normal',
                                  lineHeight:'1.5',
                                  borderLeft: `3px solid ${rec.includes('BLOCK') ? '#d32f2f' : rec.includes('WARN') ? '#f57c00' : '#1565c0'}`,
                                  paddingLeft:'10px'
                                }}>
                                  {rec}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                    {/* Detected Code Issues (client-side heuristics) */}
                    {Array.isArray(pr.codeIssues) && pr.codeIssues.length > 0 && (
                      <div style={{marginTop:16, marginBottom:20}}>
                        <h3 style={{color:'#d32f2f', fontSize:14, marginBottom:10}}>🔎 Detected Code Issues:</h3>
                        <div style={{backgroundColor:'#fff3e0', padding:10, borderRadius:4, border:'1px solid #ffb74d'}}>
                          <ul style={{margin:0, paddingLeft:20}}>
                            {pr.codeIssues.map((issue, i) => (
                              <li key={i} style={{color:'#e65100', fontSize:12, marginBottom:6}}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  
                  {/* Changed Files Section */}
                  <div style={{marginBottom:20}}>
                    <h3 style={{color:'#1a237e', fontSize:14, marginBottom:10}}>Changed Files ({pr.changedFiles.length}):</h3>
                    <div style={{backgroundColor:'white', padding:10, borderRadius:4, border:'1px solid #ddd', maxHeight:150, overflowY:'auto'}}>
                      {pr.changedFiles.length > 0 ? (
                        <ul style={{margin:0, paddingLeft:20}}>
                          {pr.changedFiles.map((file, i) => (
                            <li key={i} style={{color:'#444', fontSize:12, marginBottom:4, fontFamily:'monospace'}}>
                              {file}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{color:'#999', fontSize:12, margin:0}}>No files listed</p>
                      )}
                    </div>
                  </div>

                  {/* Missing Tests */}
                  {Array.isArray(pr.missingTests) && pr.missingTests.length > 0 && (
                    <div style={{marginBottom:20}}>
                      <h3 style={{color:'#d32f2f', fontSize:14, marginBottom:10}}>⚠ Missing Test Coverage:</h3>
                      <div style={{backgroundColor:'#ffebee', padding:10, borderRadius:4, border:'1px solid #ef5350'}}>
                        <ul style={{margin:0, paddingLeft:20}}>
                          {pr.missingTests.map((test, i) => (
                            <li key={i} style={{color:'#c62828', fontSize:12, marginBottom:4}}>{test}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Suggested Tests */}
                  {Array.isArray(pr.suggestedTests) && pr.suggestedTests.length > 0 && (
                    <div style={{marginBottom:20}}>
                      <h3 style={{color:'#1976d2', fontSize:14, marginBottom:10}}>✓ Recommended Tests:</h3>
                      <div style={{backgroundColor:'#e3f2fd', padding:10, borderRadius:4, border:'1px solid #64b5f6'}}>
                        <ul style={{margin:0, paddingLeft:20}}>
                          {pr.suggestedTests.map((test, i) => (
                            <li key={i} style={{color:'#1565c0', fontSize:12, marginBottom:4}}>{test}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Diff Preview */}
                  {pr.diff && (
                    <div style={{marginBottom:0}}>
                      <h3 style={{color:'#1a237e', fontSize:14, marginBottom:10}}>PR Description/Diff Preview:</h3>
                      <div style={{
                        backgroundColor:'#f5f5f5',
                        padding:12,
                        borderRadius:4,
                        border:'1px solid #ddd',
                        fontFamily:'Courier New, monospace',
                        fontSize:12,
                        maxHeight:400,
                        overflowY:'auto',
                        whiteSpace:'pre-wrap',
                        wordBreak:'break-word',
                        color:'#333',
                        lineHeight:1.6
                      }}>
                        {pr.diff}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Toggle Button */}
              <div style={{
                padding:'8px 16px',
                backgroundColor:'#f5f5f5',
                textAlign:'center',
                color:'#1976d2',
                cursor:'pointer',
                fontSize:12,
                fontWeight:'bold',
                userSelect:'none'
              }} onClick={() => setExpandedPR(expandedPR === idx ? null : idx)}>
                {expandedPR === idx ? '▲ Hide Details' : '▼ Show Details'}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
