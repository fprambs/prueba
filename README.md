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
| `C` | Cambiar de cámara (persecución / FPV / orbital) |
| `R` | Reiniciar posición |

## Características

- Modelo de vuelo con física simplificada: empuje, gravedad, arrastre aerodinámico y amortiguación angular.
- Tres modos de cámara: persecución en tercera persona, FPV (primera persona montada en el dron) y orbital cinemática.
- Mundo con terreno, árboles y torres como obstáculos con colisión básica.
- Aros amarillos para atravesar y sumar puntos, que se reposicionan aleatoriamente tras pasarlos.
- HUD con altitud, velocidad, rumbo, gas y contador de puertas superadas.

## Estructura del proyecto

- `index.html` — estructura de la página y HUD.
- `style.css` — estilos del HUD y pantalla de inicio.
- `main.js` — escena 3D, modelo del dron, física de vuelo, cámaras y lógica del juego.
- `vendor/three.module.min.js` — Three.js incluido localmente (sin depender de un CDN externo).
