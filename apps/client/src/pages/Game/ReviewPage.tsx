import { Chessboard } from 'react-chessboard';
import { useReviewStore } from '../../stores/reviewStore';
import { useEngineStore } from '../../stores/engineStore';
import { PlayerCard } from '../../components/Game/GameComponents';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowLeft, Download, Zap, ZapOff, BrainCircuit, TrendingUp } from 'lucide-react';
import { useEffect } from 'react';

export function ReviewPage({ onExit }: { onExit: () => void }) {
  const {
    moves,
    fens,
    currentIndex,
    whitePlayer,
    blackPlayer,
    isAnalyzing,
    analysis,
    accuracy,
    triggerAnalysis,
    nextMove,
    prevMove,
    jumpToMove,
    pgn
  } = useReviewStore();

  const { 
    evaluation, 
    bestMove: realTimeBestMove, 
    isThinking, 
    analyzePosition, 
    stopAnalysis,
    enabled: engineEnabled,
    toggleEnabled
  } = useEngineStore();

  const currentFen = fens[currentIndex] || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  
  // Use backend analysis if available, otherwise fallback to real-time engine
  const currentAnalysis = analysis?.[currentIndex];
  const displayEval = currentAnalysis ? currentAnalysis.score / 100 : evaluation;
  const bestMove = currentAnalysis ? currentAnalysis.bestMove : realTimeBestMove;

  // Re-analyze when position changes (only if backend analysis isn't present)
  useEffect(() => {
    if (engineEnabled && !currentAnalysis) {
      analyzePosition(currentFen);
    } else {
      stopAnalysis();
    }
  }, [currentIndex, currentFen, engineEnabled, analyzePosition, stopAnalysis, currentAnalysis]);

  const downloadPgn = () => {
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game_review.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getArrows = () => {
    if (!bestMove || (!engineEnabled && !analysis)) return [];
    const from = bestMove.substring(0, 2);
    const to = bestMove.substring(2, 4);
    return [[from, to, 'rgba(0, 255, 255, 0.4)']];
  };

  return (
    <div className="min-h-screen bg-bg-primary relative overflow-hidden">
      {/* Background Orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent-cyan/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-white/5 blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={onExit}
            className="flex items-center gap-2 text-text-muted hover:text-white transition-colors group"
          >
            <div className="p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
              <ArrowLeft size={20} />
            </div>
            <span className="font-medium tracking-tight">Exit Review</span>
          </button>

          <div className="flex flex-col items-center">
            <h2 className="text-3xl font-bold tracking-tighter text-gradient">Match Review</h2>
            <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-bold mt-1">
              {analysis ? 'Full Game Analyzed' : 'Post-Game Analysis'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {!analysis && (
              <button 
                onClick={triggerAnalysis}
                disabled={isAnalyzing}
                className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <BrainCircuit size={18} />
                )}
                <span className="text-xs font-bold uppercase tracking-widest">
                  {isAnalyzing ? 'Analyzing...' : 'Deep Analysis'}
                </span>
              </button>
            )}

            <button 
              onClick={toggleEnabled}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-300 ${
                engineEnabled 
                ? 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan' 
                : 'bg-white/5 border-white/10 text-text-muted'
              }`}
            >
              {engineEnabled ? <Zap size={16} /> : <ZapOff size={16} />}
              <span className="text-xs font-bold uppercase tracking-widest">Engine {engineEnabled ? 'On' : 'Off'}</span>
            </button>
            
            <button 
              onClick={downloadPgn}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-muted hover:text-white transition-colors"
              title="Export PGN"
            >
              <Download size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
          {/* Eval Bar */}
          <div className="hidden lg:block w-3 h-[600px] mt-[64px] relative">
            <EvalBar evaluation={displayEval} />
          </div>

          {/* Left: Board & Players */}
          <div className="flex flex-col gap-6 w-full max-w-xl">
            {blackPlayer && (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <PlayerCard 
                    playerName={blackPlayer?.username || 'Black Player'}
                    rating={blackPlayer?.eloRating || 1200}
                    color="b"
                    isActive={currentIndex > 0 && currentIndex % 2 === 0}
                    timeMs={undefined as any}
                    fen={currentFen}
                  />
                </div>
                {accuracy && (
                  <AccuracyBadge value={accuracy.black} label="Black" />
                )}
              </div>
            )}

            <div className="aspect-square w-full rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5 bg-zinc-900 relative">
              <Chessboard 
                position={currentFen}
                arePiecesDraggable={false}
                customDarkSquareStyle={{ backgroundColor: '#3f3f46' }}
                customLightSquareStyle={{ backgroundColor: '#e4e4e7' }}
                animationDuration={200}
                customArrows={getArrows() as any}
              />
              
              {/* Mobile Eval Bar (Overlay) */}
              <div className="lg:hidden absolute left-0 top-0 bottom-0 w-1 bg-black/40">
                <EvalBar evaluation={displayEval} />
              </div>

              {(isThinking || isAnalyzing) && (
                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                    {isAnalyzing ? 'Deep Analysis' : 'Engine Thinking'}
                  </span>
                </div>
              )}
            </div>

            {whitePlayer && (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <PlayerCard 
                    playerName={whitePlayer?.username || 'White Player'}
                    rating={whitePlayer?.eloRating || 1200}
                    color="w"
                    isActive={currentIndex % 2 !== 0 || currentIndex === 0}
                    timeMs={undefined as any}
                    fen={currentFen}
                  />
                </div>
                {accuracy && (
                  <AccuracyBadge value={accuracy.white} label="White" />
                )}
              </div>
            )}

            {/* Playback Controls */}
            <div className="glass-card p-4 flex items-center justify-center gap-4 mt-2">
              <button onClick={() => jumpToMove(0)} className="control-btn"><ChevronsLeft size={24} /></button>
              <button onClick={prevMove} className="control-btn"><ChevronLeft size={24} /></button>
              
              <div className="px-6 py-2 bg-white/5 rounded-xl font-mono text-lg font-bold text-white min-w-[80px] text-center">
                {Math.floor(currentIndex / 2) + 1}{currentIndex % 2 === 0 ? '...' : ''}
              </div>

              <button onClick={nextMove} className="control-btn"><ChevronRight size={24} /></button>
              <button onClick={() => jumpToMove(fens.length - 1)} className="control-btn"><ChevronsRight size={24} /></button>
            </div>
          </div>

          {/* Right: Move List & Quality */}
          <div className="flex-1 w-full lg:max-w-sm">
            <div className="glass-card h-[600px] flex flex-col overflow-hidden">
              <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <h3 className="font-bold text-white tracking-tight flex items-center gap-2">
                  <TrendingUp size={16} className="text-text-muted" />
                  Evolution
                </h3>
                <div className="text-[10px] font-bold text-accent-cyan uppercase tracking-widest">
                  Eval: {displayEval > 0 ? '+' : ''}{displayEval.toFixed(1)}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid grid-cols-2 gap-2">
                  {moves.map((move, idx) => {
                    const moveNum = Math.floor(idx / 2) + 1;
                    const isWhite = idx % 2 === 0;
                    const isActive = currentIndex === idx + 1;
                    
                    // Quality indicator (Simplified)
                    const moveAnalysis = analysis?.[idx + 1];
                    let qualityColor = 'transparent';
                    if (moveAnalysis) {
                       // Logic to determine color based on centipawn loss
                       qualityColor = 'rgba(255,255,255,0.05)'; 
                    }

                    return (
                      <div key={idx} className="flex items-center gap-2">
                        {isWhite && (
                          <span className="w-6 text-[10px] text-text-muted font-bold text-right mr-1">
                            {moveNum}.
                          </span>
                        )}
                        {!isWhite && <div className="w-6" />}
                        
                        <button
                          onClick={() => jumpToMove(idx + 1)}
                          className={`
                            flex-1 py-2 px-3 rounded-xl text-sm font-mono transition-all duration-200 relative
                            ${isActive 
                              ? 'bg-white text-black font-bold shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
                              : 'text-text-secondary hover:bg-white/5 hover:text-white'
                            }
                          `}
                          style={{ backgroundColor: isActive ? undefined : qualityColor }}
                        >
                          {move}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .control-btn {
          @apply p-3 rounded-xl text-text-muted hover:text-white hover:bg-white/5 transition-all active:scale-95;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}

function AccuracyBadge({ value, label }: { value: number; label: string }) {
  const colorClass = value > 90 ? 'text-accent-cyan' : value > 70 ? 'text-white' : 'text-text-muted';
  
  return (
    <div className="glass-card px-4 py-3 flex flex-col items-center min-w-[80px]">
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{label}</span>
      <div className={`text-2xl font-bold tracking-tighter ${colorClass}`}>
        {value.toFixed(1)}%
      </div>
      <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className="h-full bg-current opacity-40"
        />
      </div>
    </div>
  );
}

function EvalBar({ evaluation }: { evaluation: number }) {
  const score = Math.max(-5, Math.min(5, evaluation));
  const percentage = ((score + 5) / 10) * 100;

  return (
    <div className="w-full h-full bg-[#3f3f46] rounded-full overflow-hidden border border-white/10 flex flex-col justify-end">
      <motion.div 
        animate={{ height: `${percentage}%` }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className="w-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.2)]"
      />
    </div>
  );
}
