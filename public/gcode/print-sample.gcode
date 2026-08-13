; Bundled printing-style sample (D-07/D-08) — three inset square perimeters
; at increasing layer heights. Units: millimetres. Default XY plane, explicit.
; Hand-authored, not sourced from a real slicer export.
G21 ; millimetres
G90 ; absolute distances
G17 ; XY plane (explicit; both bundled samples stay on this plane per Pitfall C)

; --- approach layer 1 ---
G0 X10 Y10 Z5             ; rapid 1: travel to layer-1 start corner at clearance height
G0 Z0.2                   ; rapid 2: plunge to layer-1 print height

; --- layer 1: 150mm base square ---
G1 X160 Y10 F1200         ; opening feed rate 1200
G1 X160 Y160
G1 X10 Y160
G1 X10 Y10

; --- approach layer 2 ---
G0 X15 Y15 Z5             ; rapid 3: lift+travel to layer-2 start corner at clearance height
G0 Z0.4                   ; rapid 4: plunge to layer-2 print height

; --- layer 2: 140mm inset square ---
G1 X155 Y15
G1 X155 Y155
G1 X15 Y155
G1 X15 Y15

; --- approach layer 3 ---
G0 X20 Y20 Z5              ; rapid 5: lift+travel to layer-3 start corner at clearance height
G0 Z0.6                    ; rapid 6: plunge to layer-3 print height

; --- layer 3: 130mm inset square ---
G1 X150 Y20 F900           ; third layer's first cutting move: inline feed rate 900
G1 X150 Y150
G1 X20 Y150
G1 X20 Y20

; --- final retract ---
G0 Z20                     ; rapid 7: retract to clear height
