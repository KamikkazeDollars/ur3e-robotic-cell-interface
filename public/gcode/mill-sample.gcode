; Bundled milling-style sample (D-07/D-08) - closed rounded-rectangle contour
; (120mm square, 20mm corner radius) machined in three depth passes at -1mm,
; -2mm and -3mm. Units: millimetres. Default XY plane, explicit - this file
; deliberately never switches the arc working plane or the distance/unit
; mode (see 02-RESEARCH.md Pitfall C: the interpreter remaps arc I/J/centre
; coordinates per active working plane, and arcTessellation.ts only
; implements the default-plane case).
; Hand-authored, not sourced from a real CAM export. Direction alternates
; per pass (counter-clockwise, clockwise, counter-clockwise), matching a
; real CAM post's zigzag machining strategy. Every arc's I/J offset is
; relative to that arc's own start point; K is never used (XY-plane arcs
; only).
G21 ; millimetres
G90 ; absolute distances
G17 ; XY plane (explicit; both bundled samples stay on this plane per Pitfall C)

; --- approach ---
G0 Z10                      ; rapid 1: opening retract to safe clearance height
G0 X20 Y0                   ; rapid 2: positioning move to contour start (bottom-left corner tangent)

; --- pass 1: -1mm depth, counter-clockwise ---
G1 Z-1 F300                 ; plunge 1: pass-1 depth, feed 300
G1 X100 Y0 F600              ; opening cutting feed rate 600
G3 X120 Y20 I0 J20          ; bottom-right corner
G1 X120 Y100
G3 X100 Y120 I-20 J0        ; top-right corner
G1 X20 Y120
G3 X0 Y100 I0 J-20          ; top-left corner
G1 X0 Y20
G3 X20 Y0 I20 J0            ; bottom-left corner, closes back to contour start

; --- pass 2: -2mm depth, clockwise (direction alternation, real CAM zigzag) ---
G1 Z-2 F300                 ; plunge 2: pass-2 depth, feed 300
G2 X0 Y20 I0 J20 F600       ; bottom-left corner (reasserts cutting feed after the plunge)
G1 X0 Y100
G2 X20 Y120 I20 J0          ; top-left corner
G1 X100 Y120
G2 X120 Y100 I0 J-20        ; top-right corner
G1 X120 Y20
G2 X100 Y0 I-20 J0          ; bottom-right corner
G1 X20 Y0                   ; closes back to contour start

; --- pass 3: -3mm depth, counter-clockwise ---
G1 Z-3 F300                 ; plunge 3: pass-3 depth, feed 300
G1 X100 Y0 F600
G3 X120 Y20 I0 J20          ; bottom-right corner
G1 X120 Y100
G3 X100 Y120 I-20 J0        ; top-right corner
G1 X20 Y120
G3 X0 Y100 I0 J-20          ; top-left corner
G1 X0 Y20
G3 X20 Y0 I20 J0            ; bottom-left corner, closes back to contour start

; --- final retract ---
G0 Z10                      ; rapid 3: closing retract to clear height
