import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, ChevronDown, ChevronRight, BookOpen, ExternalLink, Trophy, Code, Edit2, Save, Plus, Trash2, X, Cloud, CloudOff } from 'lucide-react';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

type Task = {
  id: string;
  text: string;
  time: string;
  subtasks?: string[];
};

type Resource = {
  name: string;
  url: string;
};

type Week = {
  id: number;
  title: string;
  goal: string;
  resources?: Resource[];
  tasks: Task[];
};

type Phase = {
  id: string;
  title: string;
  weeks: Week[];
};

// Placeholder for initial load - will be replaced by JSON data
const defaultCurriculum: Phase[] = [
  {
    id: 'phase1',
    title: 'PHASE 1: FOUNDATION',
    weeks: [
      {
        id: 1,
        title: 'Week 1: MCP Server Basics',
        goal: 'Build your first MCP server that exposes Salesforce data',
        resources: [
          { name: 'Anthropic MCP Docs', url: 'https://modelcontextprotocol.io' },
          { name: 'MCP Python SDK', url: 'https://github.com/modelcontextprotocol/python-sdk' }
        ],
        tasks: [
          { id: 'w1t1', text: 'Set up MCP dev environment (Python SDK, Docs)', time: '1 hr' },
          { id: 'w1t2', text: 'Build simple MCP server (2-3 tools)', time: '3 hrs' },
          { id: 'w1t3', text: 'Deploy to local Docker container', time: '1 hr' }
        ]
      },
      {
        id: 2,
        title: 'Week 2: RAG Implementation',
        goal: 'Add vector search capabilities to your MCP server',
        tasks: [
          { id: 'w2t1', text: 'Set up vector database (ChromaDB/Pinecone)', time: '1.5 hrs' },
          { id: 'w2t2', text: 'Implement RAG pattern (semantic_search tool)', time: '2.5 hrs' },
          { id: 'w2t3', text: 'Document token usage patterns', time: '1 hr' }
        ]
      },
      {
        id: 3,
        title: 'Week 3: Memory & Context Management',
        goal: 'Add persistent memory to your agent',
        tasks: [
          { id: 'w3t1', text: 'Implement conversation memory (SQLite/PG)', time: '2 hrs' },
          { id: 'w3t2', text: 'Build context summarization (Rolling window)', time: '2 hrs' },
          { id: 'w3t3', text: 'Token optimization experiments', time: '1 hr' }
        ]
      }
    ]
  },
  {
    id: 'phase2',
    title: 'PHASE 2: MULTI-AGENT ARCHITECTURE',
    weeks: [
      {
        id: 4,
        title: 'Week 4: Agent-to-Agent Protocol (A2A)',
        goal: 'Create multiple specialized agents that can communicate',
        resources: [
          { name: 'A2A Protocol Spec', url: 'https://a2a.ai' }
        ],
        tasks: [
          { id: 'w4t1', text: 'Design agent architecture (Researcher, Analyzer, Recommender)', time: '1 hr' },
          { id: 'w4t2', text: 'Implement A2A protocol & message passing', time: '3 hrs' },
          { id: 'w4t3', text: 'Test inter-agent communication', time: '1 hr' }
        ]
      },
      {
        id: 5,
        title: 'Week 5: Building Specialized Agents',
        goal: 'Create three distinct agents with clear responsibilities',
        tasks: [
          { id: 'w5t1', text: 'Build Researcher Agent (MCP connection)', time: '1.5 hrs' },
          { id: 'w5t2', text: 'Build Analyzer Agent (Sentiment/Pattern)', time: '1.5 hrs' },
          { id: 'w5t3', text: 'Build Recommender Agent (Actionable output)', time: '1.5 hrs' },
          { id: 'w5t4', text: 'Wire all three together', time: '0.5 hrs' }
        ]
      },
      {
        id: 6,
        title: 'Week 6: Agent Orchestration',
        goal: 'Add intelligent routing and parallel execution',
        tasks: [
          { id: 'w6t1', text: 'Implement orchestration layer (Router)', time: '2.5 hrs' },
          { id: 'w6t2', text: 'Add monitoring and logging (Latency/Tokens)', time: '1.5 hrs' },
          { id: 'w6t3', text: 'Test complex multi-step workflows', time: '1 hr' }
        ]
      }
    ]
  },
  {
    id: 'phase3',
    title: 'PHASE 3: ADVANCED CAPABILITIES',
    weeks: [
      {
        id: 7,
        title: 'Week 7: Continuous Learning System',
        goal: 'Enable agents to learn from interactions',
        tasks: [
          { id: 'w7t1', text: 'Implement feedback loop (User feedback)', time: '2 hrs' },
          { id: 'w7t2', text: 'Build learning mechanism (Dynamic prompts)', time: '2 hrs' },
          { id: 'w7t3', text: 'A/B test learning improvements', time: '1 hr' }
        ]
      },
      {
        id: 8,
        title: 'Week 8: Advanced Token Optimization',
        goal: 'Minimize costs while maintaining quality',
        tasks: [
          { id: 'w8t1', text: 'Implement smart caching (Embeddings)', time: '2 hrs' },
          { id: 'w8t2', text: 'Optimize agent prompts (Compression)', time: '1.5 hrs' },
          { id: 'w8t3', text: 'Implement streaming and partial responses', time: '1.5 hrs' }
        ]
      },
      {
        id: 9,
        title: 'Week 9: Cross-Platform Integration',
        goal: 'Connect to other AI platforms (Copilot, Gemini)',
        tasks: [
          { id: 'w9t1', text: 'Research platform-specific protocols', time: '1 hr' },
          { id: 'w9t2', text: 'Build adapter layer (MCP-to-Copilot)', time: '3 hrs' },
          { id: 'w9t3', text: 'Test cross-platform handoffs', time: '1 hr' }
        ]
      }
    ]
  },
  {
    id: 'phase4',
    title: 'PHASE 4: POLISH & PRODUCTION',
    weeks: [
      {
        id: 10,
        title: 'Week 10: Security & Governance',
        goal: 'Add enterprise-grade security controls',
        tasks: [
          { id: 'w10t1', text: 'Implement Auth/RBAC', time: '2 hrs' },
          { id: 'w10t2', text: 'Add audit logging & compliance reports', time: '1.5 hrs' },
          { id: 'w10t3', text: 'Data privacy controls (PII masking)', time: '1.5 hrs' }
        ]
      },
      {
        id: 11,
        title: 'Week 11: Demo Environment',
        goal: 'Create customer-facing demo and documentation',
        tasks: [
          { id: 'w11t1', text: 'Build demo UI (Streamlit/Gradio)', time: '2 hrs' },
          { id: 'w11t2', text: 'Create technical documentation', time: '2 hrs' },
          { id: 'w11t3', text: 'Record demo walkthrough', time: '1 hr' }
        ]
      },
      {
        id: 12,
        title: 'Week 12: Advanced Scenarios',
        goal: 'Handle edge cases and optimize for scale',
        tasks: [
          { id: 'w12t1', text: 'Implement advanced scenarios (Multi-turn)', time: '2 hrs' },
          { id: 'w12t2', text: 'Performance optimization (Load testing)', time: '2 hrs' },
          { id: 'w12t3', text: 'Create reusable templates', time: '1 hr' }
        ]
      }
    ]
  }
];

// --- MAIN COMPONENT ---
export default function AIEnablementTracker() {
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [expandedPhase, setExpandedPhase] = useState<string | null>('phase1'); // Default open Phase 1
  const [curriculum, setCurriculum] = useState<Phase[]>(defaultCurriculum);
  const [editMode, setEditMode] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load curriculum from Firestore (with fallback to JSON)
  useEffect(() => {
    const loadCurriculum = async () => {
      try {
        setIsSyncing(true);
        // Try to load from Firestore first
        const docRef = doc(db, 'curriculum', 'main');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          // Data exists in cloud - load it
          const data = docSnap.data();
          setCurriculum(data.phases as Phase[]);
          setCloudSyncEnabled(true);
          console.log('✅ Loaded curriculum from cloud');
        } else {
          // Database is empty but connection works - load from local JSON
          // Keep cloud sync enabled so user can upload
          console.log('📤 Cloud connected but empty. Load local data and enable upload.');
          setCloudSyncEnabled(true);
          const res = await fetch('/curriculum.json');
          const data: Phase[] = await res.json();
          setCurriculum(data);
        }
      } catch (err) {
        // Connection failed - disable cloud sync
        console.log('❌ Cloud sync disabled (connection failed):', err);
        setCloudSyncEnabled(false);
        // Fallback to local JSON file
        fetch('/curriculum.json')
          .then(res => res.json())
          .then((data: Phase[]) => {
            setCurriculum(data);
          })
          .catch(jsonErr => {
            console.error('Failed to load curriculum from JSON:', jsonErr);
          });
      } finally {
        setIsSyncing(false);
      }
    };

    loadCurriculum();
  }, []);

  // Load completed tasks from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ai-plan-progress');
    if (saved) {
      const parsed: string[] = JSON.parse(saved);
      setCompletedTasks(new Set(parsed));
    }
  }, []);

  const toggleTask = (taskId: string) => {
    setCompletedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      localStorage.setItem('ai-plan-progress', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  };

  const toggleSubtasks = (taskId: string) => {
    setExpandedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const addTask = (phaseId: string, weekId: number) => {
    const newTaskId = `w${weekId}t${Date.now()}`;
    const newTask: Task = {
      id: newTaskId,
      text: 'New Task',
      time: '1 hr',
      subtasks: []
    };
    
    setCurriculum(prev => prev.map(phase => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          weeks: phase.weeks.map(week => {
            if (week.id === weekId) {
              return { ...week, tasks: [...week.tasks, newTask] };
            }
            return week;
          })
        };
      }
      return phase;
    }));
  };

  const updateTask = (phaseId: string, weekId: number, taskId: string, updates: Partial<Task>) => {
    setCurriculum(prev => prev.map(phase => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          weeks: phase.weeks.map(week => {
            if (week.id === weekId) {
              return {
                ...week,
                tasks: week.tasks.map(task => 
                  task.id === taskId ? { ...task, ...updates } : task
                )
              };
            }
            return week;
          })
        };
      }
      return phase;
    }));
  };

  const deleteTask = (phaseId: string, weekId: number, taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    setCurriculum(prev => prev.map(phase => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          weeks: phase.weeks.map(week => {
            if (week.id === weekId) {
              return {
                ...week,
                tasks: week.tasks.filter(task => task.id !== taskId)
              };
            }
            return week;
          })
        };
      }
      return phase;
    }));
  };

  const addSubtask = (phaseId: string, weekId: number, taskId: string) => {
    setCurriculum(prev => prev.map(phase => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          weeks: phase.weeks.map(week => {
            if (week.id === weekId) {
              return {
                ...week,
                tasks: week.tasks.map(task => {
                  if (task.id === taskId) {
                    return {
                      ...task,
                      subtasks: [...(task.subtasks || []), 'New subtask']
                    };
                  }
                  return task;
                })
              };
            }
            return week;
          })
        };
      }
      return phase;
    }));
  };

  const updateSubtask = (phaseId: string, weekId: number, taskId: string, subtaskIndex: number, newText: string) => {
    setCurriculum(prev => prev.map(phase => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          weeks: phase.weeks.map(week => {
            if (week.id === weekId) {
              return {
                ...week,
                tasks: week.tasks.map(task => {
                  if (task.id === taskId && task.subtasks) {
                    const newSubtasks = [...task.subtasks];
                    newSubtasks[subtaskIndex] = newText;
                    return { ...task, subtasks: newSubtasks };
                  }
                  return task;
                })
              };
            }
            return week;
          })
        };
      }
      return phase;
    }));
  };

  const deleteSubtask = (phaseId: string, weekId: number, taskId: string, subtaskIndex: number) => {
    setCurriculum(prev => prev.map(phase => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          weeks: phase.weeks.map(week => {
            if (week.id === weekId) {
              return {
                ...week,
                tasks: week.tasks.map(task => {
                  if (task.id === taskId && task.subtasks) {
                    return {
                      ...task,
                      subtasks: task.subtasks.filter((_, i) => i !== subtaskIndex)
                    };
                  }
                  return task;
                })
              };
            }
            return week;
          })
        };
      }
      return phase;
    }));
  };

  const saveCurriculum = async () => {
    try {
      setIsSyncing(true);
      
      if (cloudSyncEnabled) {
        // Save to Firestore (syncs across devices)
        const docRef = doc(db, 'curriculum', 'main');
        await setDoc(docRef, {
          phases: curriculum,
          lastUpdated: new Date().toISOString()
        });
        
        alert('✅ Changes saved to cloud! \n\nYour curriculum will sync across all devices automatically.');
      } else {
        // Fallback: Save to localStorage and download
        localStorage.setItem('curriculum-data', JSON.stringify(curriculum));
        
        // Create downloadable JSON file
        const dataStr = JSON.stringify(curriculum, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'curriculum.json';
        link.click();
        URL.revokeObjectURL(url);
        
        alert('⚠️ Cloud sync disabled. Changes saved locally and downloaded.\n\nTo enable cloud sync, configure Firebase (see CLOUD-SYNC-SETUP.md)');
      }
      
      setEditMode(false);
    } catch (error) {
      console.error('Failed to save:', error);
      alert('❌ Error saving changes. Check console for details.');
    } finally {
      setIsSyncing(false);
    }
  };

  const calculateProgress = () => {
    const totalTasks = curriculum.reduce((acc, phase) => 
      acc + phase.weeks.reduce((wAcc, week) => wAcc + week.tasks.length, 0), 0
    );
    return Math.round((completedTasks.size / totalTasks) * 100);
  };

  const isWeekComplete = (week: Week) => {
    return week.tasks.every((t) => completedTasks.has(t.id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-slate-50 text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 animate-fade-in">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-indigo-900 flex items-center gap-3 mb-1">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Code className="w-8 h-8 text-indigo-600" />
                </div>
                12-Week AI Agent Master Plan
              </h1>
              <p className="text-slate-600 mt-3 text-sm md:text-base">
                Building an Interoperable Multi-Agent Customer Intelligence System
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              {/* Cloud Sync Status */}
              <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full ${
                cloudSyncEnabled 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {isSyncing ? (
                  <>
                    <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Syncing...</span>
                  </>
                ) : cloudSyncEnabled ? (
                  <>
                    <Cloud className="w-3 h-3" />
                    <span>Cloud Sync On</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-3 h-3" />
                    <span>Local Only</span>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {editMode && (
                  <button
                    onClick={() => setEditMode(false)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all bg-slate-200 hover:bg-slate-300 text-slate-700"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => editMode ? saveCurriculum() : setEditMode(true)}
                  disabled={isSyncing}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    editMode 
                      ? 'bg-green-600 hover:bg-green-700 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed' 
                      : 'bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200'
                  }`}
                >
                  {editMode ? (
                    <>
                      <Save className="w-4 h-4" />
                      {cloudSyncEnabled ? 'Save to Cloud' : 'Save & Download'}
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4" />
                      Edit Mode
                    </>
                  )}
                </button>
              </div>
              <div className="text-right hidden md:block">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Overall Progress</div>
                <div className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {calculateProgress()}%
                </div>
              </div>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
            <div 
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 h-3 transition-all duration-500 ease-out shadow-lg"
              style={{ width: `${calculateProgress()}%` }}
            ></div>
          </div>
        </header>

        {/* Edit Mode Notice */}
        {editMode && (
          <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-lg animate-fade-in">
            <div className="flex items-start gap-3">
              <Edit2 className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-900 mb-1">Edit Mode Active</h3>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Click on any task field to edit. Add subtasks, modify descriptions, or delete tasks. 
                  Click <strong>"Save & Download"</strong> when done—your changes will download as <code className="bg-amber-100 px-1 rounded">curriculum.json</code>. 
                  Replace the file in <code className="bg-amber-100 px-1 rounded">public/curriculum.json</code> to make changes permanent.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {curriculum.map((phase) => (
            <div key={phase.id} className="bg-white rounded-xl shadow-md hover:shadow-xl border border-slate-200 overflow-hidden transition-all duration-300">
              <button 
                onClick={() => setExpandedPhase(expandedPhase === phase.id ? null : phase.id)}
                className="w-full flex items-center justify-between p-6 bg-gradient-to-r from-slate-50 to-indigo-50/30 hover:from-slate-100 hover:to-indigo-100/40 transition-all duration-200"
              >
                <h2 className="text-xl font-bold text-slate-800">{phase.title}</h2>
                <div className="transition-transform duration-200">
                  {expandedPhase === phase.id ? <ChevronDown className="text-indigo-600" /> : <ChevronRight className="text-slate-400" />}
                </div>
              </button>

              {expandedPhase === phase.id && (
                <div className="p-6 space-y-8 border-t border-slate-100 bg-gradient-to-b from-white to-slate-50/30">
                  {phase.weeks.map((week) => (
                    <div key={week.id} className="relative pl-5 border-l-3 border-indigo-300 hover:border-indigo-500 transition-colors duration-200">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-indigo-700 flex items-center gap-2 mb-2">
                            <span className="flex items-center gap-2">
                              {week.title}
                              {isWeekComplete(week) && (
                                <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full animate-bounce-subtle">
                                  <Trophy className="w-3 h-3" />
                                  Complete!
                                </span>
                              )}
                            </span>
                          </h3>
                          <p className="text-sm text-slate-600 leading-relaxed">{week.goal}</p>
                        </div>
                        {week.resources && (
                          <div className="flex gap-2 ml-4">
                            {week.resources.map((res, idx) => (
                              <a 
                                key={idx} 
                                href={res.url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-xs flex items-center gap-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap"
                              >
                                <BookOpen className="w-3 h-3" />
                                {res.name}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2.5 mt-4">
                        {week.tasks.map((task) => (
                          <div key={task.id} className="space-y-1">
                            {editMode ? (
                              // EDIT MODE: Editable task
                              <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 space-y-3">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={task.text}
                                    onChange={(e) => updateTask(phase.id, week.id, task.id, { text: e.target.value })}
                                    className="flex-grow px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    placeholder="Task description"
                                  />
                                  <input
                                    type="text"
                                    value={task.time}
                                    onChange={(e) => updateTask(phase.id, week.id, task.id, { time: e.target.value })}
                                    className="w-24 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono"
                                    placeholder="1 hr"
                                  />
                                  <button
                                    onClick={() => deleteTask(phase.id, week.id, task.id)}
                                    className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors"
                                    title="Delete task"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                                
                                {/* Subtasks in edit mode */}
                                <div className="ml-4 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Subtasks</span>
                                    <button
                                      onClick={() => addSubtask(phase.id, week.id, task.id)}
                                      className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-md transition-colors"
                                    >
                                      <Plus className="w-3 h-3" />
                                      Add Subtask
                                    </button>
                                  </div>
                                  {task.subtasks?.map((subtask, idx) => (
                                    <div key={idx} className="flex gap-2">
                                      <input
                                        type="text"
                                        value={subtask}
                                        onChange={(e) => updateSubtask(phase.id, week.id, task.id, idx, e.target.value)}
                                        className="flex-grow px-3 py-1.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        placeholder="Subtask description"
                                      />
                                      <button
                                        onClick={() => deleteSubtask(phase.id, week.id, task.id, idx)}
                                        className="px-2 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-md transition-colors"
                                        title="Delete subtask"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              // VIEW MODE: Normal task display
                              <>
                                <div 
                                  className={`
                                    group flex items-center gap-3 p-3.5 rounded-lg border cursor-pointer transition-all duration-200 transform
                                    ${completedTasks.has(task.id) 
                                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 opacity-70 hover:opacity-100' 
                                      : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md hover:-translate-y-0.5 hover:bg-indigo-50/30'}
                                  `}
                                >
                                  <div 
                                    onClick={() => toggleTask(task.id)}
                                    className={`
                                      w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full transition-all duration-200
                                      ${completedTasks.has(task.id) 
                                        ? 'text-green-600 scale-110' 
                                        : 'text-slate-300 group-hover:text-indigo-400 group-hover:scale-110'}
                                    `}
                                  >
                                    {completedTasks.has(task.id) ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                  </div>
                                  <div 
                                    onClick={() => toggleTask(task.id)}
                                    className="flex-grow"
                                  >
                                    <span className={`text-sm font-medium transition-all ${completedTasks.has(task.id) ? 'line-through text-slate-500' : 'text-slate-700 group-hover:text-indigo-900'}`}>
                                      {task.text}
                                    </span>
                                  </div>
                                  <div className={`text-xs font-mono px-2.5 py-1 rounded-md whitespace-nowrap transition-colors ${completedTasks.has(task.id) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700'}`}>
                                    {task.time}
                                  </div>
                                  {task.subtasks && task.subtasks.length > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSubtasks(task.id);
                                      }}
                                      className="text-slate-400 hover:text-indigo-600 transition-colors"
                                    >
                                      {expandedTasks.has(task.id) ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                </div>
                                {task.subtasks && task.subtasks.length > 0 && expandedTasks.has(task.id) && (
                                  <div className="ml-12 mr-3 space-y-1.5 animate-fade-in">
                                    {task.subtasks.map((subtask, idx) => (
                                      <div 
                                        key={idx}
                                        className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 p-2.5 rounded-md border border-slate-100"
                                      >
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0"></div>
                                        <span>{subtask}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                        
                        {/* Add New Task Button (only in edit mode) */}
                        {editMode && (
                          <button
                            onClick={() => addTask(phase.id, week.id)}
                            className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 rounded-lg text-slate-600 hover:text-indigo-600 transition-all duration-200"
                          >
                            <Plus className="w-4 h-4" />
                            <span className="text-sm font-medium">Add New Task</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-slate-500 bg-white px-6 py-3 rounded-full shadow-sm border border-slate-200">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="font-medium">5 hours/week commitment</span>
            <span className="text-slate-300">•</span>
            <span>Data saves automatically</span>
          </div>
        </div>
      </div>
    </div>
  );
}

