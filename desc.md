# Thermoprops + CoolProp WASM

Thermoprops es una SPA construida con React y Vite que calcula propiedades termodinámicas de fluidos usando el motor WebAssembly de [CoolProp](https://coolprop.org/). La aplicación organiza su flujo en tres vistas principales: configuración inicial, resultados de estado y visualización gráfica. La aplicacion debe estar hecha en ingles.

## Integración con @luisbedoia/coolprop-wasm

- `src/coolprop.ts` expone una función `CP()` que hace una importación dinámica de `@luisbedoia/coolprop-wasm` y resuelve el módulo Embind. Una vez inicializado, la instancia se guarda en `window.CP`, tipada globalmente en `src/global.d.ts`.
- `src/App.tsx` ejecuta `CP()` en un `useEffect`, bloqueando la UI con “Loading library…” hasta que el módulo WASM está listo. Esta composición asegura que el resto de la app solo se renderice cuando `window.CP` exista.

## Flujo previsto de la aplicación

1. **Selección inicial**
   - Elegir fluido desde una lista con nombres y alias (incluyendo fórmulas químicas).
   * La lista de fluidos se obtiene de `CoolProp.get_global_param_string("fluids_list")`
   * Invocando `CoolProp.get_fluid_param_string(fluid_name, "aliases")` para mostrar alias.
   * Invocando `CoolProp.get_fluid_param_string(fluid_name, "formula")` para mostrar la fórmula química si la tiene.
   - Seleccionar el sistema de unidades (por defecto SI con temperatura en °C).
   - Confirmar para cargar la gráfica base.

2. **Gráfica de saturación**
   - Mostrar un placeholder.

3. **Cálculo de estados**
   - Al lado de la gráfica, un panel de entrada de datos.
   - Formulario lateral para escoger dos propiedades independientes (T, P, D, H, S, U, Q, etc.) e ingresar valores.
   - Al confirmar, calcular el resto de propiedades relevantes usando `PropsSI` y mostrarlas en un panel de resultados.

4. **Gestión de múltiples estados**
   - Botón para añadir más estados; cada estado debe representarse tanto en la lista de resultados como en la gráfica.
   - Almacenar un historial de estados para permitir comparaciones y visualización simultánea.

## Estado de la aplicación

La aplicacion debe guardar el estado en la URL usando query parameters para permitir compartir configuraciones específicas.
