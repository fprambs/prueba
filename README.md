# 🛸 AustroDrone

Simulador de vuelo de dron 3D en el navegador, hecho con [Three.js](https://threejs.org/) y JavaScript puro (sin build ni dependencias que instalar).

## Cómo ejecutarlo

Es un sitio estático, así que solo necesitas servirlo con cualquier servidor HTTP local (no funciona con `file://` por las restricciones de módulos ES):

```bash
python3 -m http.server 8000
```

Luego abre `http://localhost:8000` en el navegador.

## Controles

| Tecla | Acción |
| --- | --- |
| `W` / `S` | Subir / bajar gas (empuje vertical) |
| `↑` / `↓` | Inclinar adelante / atrás (cabeceo) |
| `←` / `→` | Inclinar izquierda / derecha (alabeo) |
| `A` / `D` | Girar sobre su propio eje (guiñada) |
| `Shift` | Impulso extra |
| `Espacio` | Autoestabilizar (nivelar el dron) |
| `C` | Cambiar de cámara (geográfica / FPV / cinemática / panorámica) |
| `[` / `]` | Inclinar el gimbal de la cámara FPV |
| `R` | Reiniciar posición |

## Flujo previo al vuelo

Antes de entrar al simulador, la app muestra 3 pantallas de marca AustroDrone: **Bienvenida** → **Selecciona tu aeronave** → **Consejos de seguridad**. Cada aeronave (EXP PLAY, INSPECTOR PRO, AGRI SPRAY X8) tiene sus propias especificaciones y física de vuelo real.

## Características

- Modelo de vuelo con control de velocidad objetivo (altitude/position hold estilo DJI): los sticks mandan una velocidad de ascenso/avance deseada y el dron converge suavemente hacia ella, deteniéndose y manteniendo posición de inmediato al centrarlos.
- 3 aeronaves seleccionables (EXP PLAY, INSPECTOR PRO, AGRI SPRAY X8), cada una con su propio preset de vuelo, batería y alcance.
- Cuatro modos de cámara: Geográfica (persecución en tercera persona), FPV (montada en el morro del dron, con gimbal inclinable), Cinemático (seguimiento con retraso suave y amortiguado) y Panorámica (seguimiento amplio y ágil que siempre mantiene el dron completo en cuadro). Las transiciones entre cámaras se mezclan suavemente.
- HUD de desempeño: batería y alcance restantes en tiempo real, calculados con las especificaciones reales de la aeronave seleccionada.
- Mundo con terreno, árboles y torres como obstáculos con colisión básica.
- Aros amarillos para atravesar y sumar puntos, que se reposicionan aleatoriamente tras pasarlos.
- HUD con altitud, velocidad, rumbo, batería, alcance y contador de puertas superadas.

## Estructura del proyecto

- `index.html` — estructura de la página, flujo previo al vuelo y HUD.
- `style.css` — estilos del HUD, pantallas previas y pantalla de inicio.
- `main.js` — escena 3D, modelo del dron, física de vuelo, cámaras y lógica del juego.
- `assets/` — imágenes recortadas de la marca AustroDrone (aeronaves y piloto) usadas en las pantallas previas.
- `vendor/three.module.min.js` — Three.js incluido localmente (sin depender de un CDN externo).
