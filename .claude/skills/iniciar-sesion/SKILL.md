---
name: iniciar-sesion
description: Inicia una sesión de trabajo en Futbol Crespo sincronizando la carpeta local con el repo de GitHub (git pull). Usar cuando el usuario diga "iniciar sesión", "empezar sesión", "/iniciar-sesion" o pida traer los últimos cambios del repo.
---

# Iniciar sesión

Sincroniza `C:\Futbol Crespo` con https://github.com/francopittavino/FutbolCrespo antes de empezar a trabajar.

Repo remoto: `https://github.com/francopittavino/FutbolCrespo.git` — rama principal: `main`.

## Pasos

1. **Verificar que la carpeta sea un repo git.** Ejecutar `git rev-parse --is-inside-work-tree` en la raíz del proyecto.
   - Si NO es un repo:
     - `git init -b main`
     - `git remote add origin https://github.com/francopittavino/FutbolCrespo.git`
   - Si ya es un repo, verificar con `git remote get-url origin` que `origin` apunte a la URL de arriba. Si no existe, agregarlo; si apunta a otra URL, avisar al usuario y no cambiarlo sin su confirmación.

2. **Traer el estado remoto:** `git fetch origin`.
   - Si `git ls-remote --heads origin main` no devuelve nada, el repo remoto todavía está vacío: informar que no hay nada para traer y terminar (el primer push lo hará `/cerrar-sesion`).

3. **Revisar cambios locales sin commitear** con `git status --porcelain`.
   - Si hay cambios, NO descartarlos. Mostrárselos al usuario y preguntar si quiere: (a) hacer `git stash`, pull y `git stash pop`, o (b) commitearlos primero, o (c) cancelar.

4. **Hacer el pull:**
   - Si la rama local `main` todavía no tiene commits (repo recién inicializado): `git checkout -B main origin/main` y `git branch --set-upstream-to=origin/main main`. Si hay archivos locales sin trackear que chocarían con los del remoto, listarlos y preguntar antes de sobrescribir.
   - Si no: `git pull --rebase origin main`.
   - Si hay conflictos, detenerse, listar los archivos en conflicto y ayudar a resolverlos; nunca usar `--force` ni `reset --hard` sin confirmación explícita.

5. **Resumen final:** mostrar la rama actual, el último commit (`git log -1 --oneline`) y cuántos commits nuevos se trajeron (o "ya estaba al día").
