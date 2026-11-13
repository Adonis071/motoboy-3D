import re
import os

path = 'src/components/HUD.tsx'
if not os.path.exists(path):
    print(f"File {path} not found")
    exit(1)

content = open(path).read()

# 1. Remove OnFootDPad component
pattern = re.compile(r'const OnFootDPad: React\.FC<.*?> = \(.*?\) => \{.*?};\n\n', re.DOTALL)
content = pattern.sub('', content)

# 2. Remove walkingControlType state
content = content.replace("  const [walkingControlType, setWalkingControlType] = useState<'dpad' | 'joystick'>('dpad');\n", '')

# 3. Simplify on-foot control area
# Find the start of on-foot controls
on_foot_start = content.find('{telemetry.isOnFoot ? (')
if on_foot_start != -1:
    # Find the controls row container
    row_start_marker = '<div className="flex items-end justify-between w-full gap-2">'
    row_start = content.find(row_start_marker, on_foot_start)
    # Find where the right side action chips start
    right_chips_start = content.find('{/* RIGHT SIDE: ON-FOOT ACTION CHIPS', row_start)
    
    if row_start != -1 and right_chips_start != -1:
        # Define the new unified joystick block
        new_joystick = '''            {/* UNIFIED ON-FOOT JOYSTICK (Bolinha) */}
            <div
              data-hud-control="true"
              className="pointer-events-auto flex items-center p-2"
            >
              <div
                data-hud-control="true"
                className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-slate-950/85 backdrop-blur-md border-2 border-emerald-400 shadow-2xl flex items-center justify-center select-none touch-none cursor-pointer"
                onPointerDown={handleGesturePointerDown}
                onPointerMove={handleGesturePointerMove}
                onPointerUp={handleGesturePointerUp}
                onPointerCancel={handleGesturePointerUp}
              >
                {/* Visual guidelines */}
                <div className="absolute inset-4 rounded-full border border-white/5 bg-slate-900/40 shadow-inner pointer-events-none" />
                <div className="absolute inset-x-8 h-px bg-emerald-500/20 pointer-events-none" />
                <div className="absolute inset-y-8 w-px bg-emerald-500/20 pointer-events-none" />
                
                <span className="absolute top-2 text-[7px] font-black text-emerald-400/60 uppercase tracking-[0.2em]">DIREÇÃO</span>
                <span className="absolute bottom-2 text-[7px] font-black text-slate-500">
                  {gestureState.isSprint ? '⚡ CORRENDO' : '🚶 ANDANDO'}
                </span>

                {/* The Bolinha (Joystick Knob) */}
                <div
                  className={`w-14 h-14 rounded-full border-2 shadow-2xl flex items-center justify-center transition-transform pointer-events-none ${
                    gestureState.active
                      ? 'bg-emerald-500 border-white shadow-emerald-400/80 scale-110'
                      : 'bg-slate-800 border-emerald-500/40'
                  }`}
                  style={{
                    transform: gestureState.active
                      ? `translate(${gestureState.currX - gestureState.originX}px, ${gestureState.currY - gestureState.originY}px)`
                      : 'translate(0px, 0px)',
                  }}
                >
                  <div className={`w-4 h-4 rounded-full transition-all ${gestureState.active ? 'bg-white scale-125' : 'bg-emerald-400/50'}`} />
                </div>
              </div>
            </div>
'''
        # Replace the entire left half with the new joystick
        insertion_point = row_start + len(row_start_marker)
        content = content[:insertion_point] + "\n" + new_joystick + content[right_chips_start:]
        
        with open(path, 'w') as f:
            f.write(content)
        print('SUCCESS SIMPLIFYING HUD')
    else:
        print(f'Could not find segments: row_start={row_start}, right_chips_start={right_chips_start}')
else:
    print('Could not find on_foot_start')
