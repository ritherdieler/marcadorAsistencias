import type { FaceCoverageConfig, FaceGuideSettings } from '../../recognition/services/faceAlignmentConfig'
import { LayerToggle } from './LayerToggle'
import { ToggleSwitch } from './ToggleSwitch'

type VisualGuideControlsProps = {
  draft: FaceCoverageConfig
  onFaceGuideChange: (key: keyof FaceGuideSettings, value: boolean) => void
  onShowFaceBoxChange: (value: boolean) => void
}

export function VisualGuideControls({ draft, onFaceGuideChange, onShowFaceBoxChange }: VisualGuideControlsProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Guias visuales</h2>
        <p className="mt-1 text-sm text-slate-600">
          Ayudas sobre la camara para acercar, centrar o encajar el rostro sin mostrar porcentajes al usuario.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="text-sm font-semibold text-slate-900">Guia de posicion</div>
        <div className="grid gap-2">
          <LayerToggle
            label="Marco objetivo (banda min–max)"
            checked={draft.faceGuide.showTargetOval}
            onChange={(value) => onFaceGuideChange('showTargetOval', value)}
          />
          <LayerToggle
            label="Flechas de direccion animadas"
            checked={draft.faceGuide.showDirectionArrows}
            onChange={(value) => onFaceGuideChange('showDirectionArrows', value)}
          />
          <LayerToggle
            label="Barra de zonas (lejos / bien / cerca)"
            checked={draft.faceGuide.showZoneBar}
            onChange={(value) => onFaceGuideChange('showZoneBar', value)}
          />
          <LayerToggle
            label="Atenuar fondo fuera del rostro"
            checked={draft.faceGuide.dimOutside}
            onChange={(value) => onFaceGuideChange('dimOutside', value)}
          />
          <LayerToggle
            label="Anillo de cercania (feedback al acercarse)"
            checked={draft.faceGuide.showProximityRing}
            onChange={(value) => onFaceGuideChange('showProximityRing', value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div>
          <div className="text-sm font-semibold text-slate-900">Marco del rostro</div>
          <p className="mt-1 text-xs text-slate-600">
            Dibuja la caja rectangular con esquinas sobre el rostro detectado. No afecta la deteccion.
          </p>
        </div>
        <ToggleSwitch
          checked={draft.showFaceBox}
          label="Mostrar marco del rostro"
          onChange={onShowFaceBoxChange}
        />
      </div>
    </div>
  )
}
