---
name: cerrar-sesion
description: Cierra la sesión de trabajo en Futbol Crespo commiteando los cambios y subiéndolos al repo de GitHub (git push). Usar cuando el usuario diga "cerrar sesión", "terminar sesión", "/cerrar-sesion" o pida subir/guardar los cambios en el repo.
---

# Cerrar sesión

Guarda el trabajo de la sesión y lo sube a https://github.com/francopittavino/FutbolCrespo.

Repo remoto: `https://github.com/francopittavino/FutbolCrespo.git` — rama principal: `main`.

## Pasos

1. **Verificar el repo.** Si la carpeta no es un repo git, inicializarlo igual que en `/iniciar-sesion` (`git init -b main` + `git remote add origin https://github.com/francopittavino/FutbolCrespo.git`). Confirmar que `origin` apunte a esa URL.

2. **Revisar qué cambió:** `git status` y `git diff --stat`.
   - Si no hay cambios y no hay commits pendientes de subir (`git log origin/main..HEAD` vacío), informar "nada para subir" y terminar.
   - Revisar que no se suban secretos ni basura (archivos `.env`, credenciales, claves, `node_modules`, builds, archivos temporales). Si aparecen, avisar al usuario y proponer agregarlos a `.gitignore` en lugar de commitearlos.

3. **Commitear:**
   - `git add -A` (excluyendo lo marcado en el paso anterior).
   - Redactar un mensaje de commit en español, breve y descriptivo de lo que se hizo en la sesión (basado en el diff). Formato: una línea de resumen y, si hace falta, una lista corta de cambios.
   - Terminar el mensaje con la línea de atribución indicada por el sistema, si corresponde.

4. **Integrar cambios remotos antes de subir:**
   - Si `origin/main` existe (`git ls-remote --heads origin main`): `git pull --rebase origin main`. Si hay conflictos, detenerse y ayudar a resolverlos.
   - Si el remoto está vacío, saltear este paso.

5. **Push:** `git push -u origin main`.
   - Nunca usar `--force` sin confirmación explícita del usuario.
   - Si falla por autenticación, pedirle al usuario que inicie sesión (por ejemplo con `! gh auth login` o configurando Git Credential Manager) y reintentar.

6. **Resumen final:** mostrar el/los commits subidos (`git log --oneline -n 5`) y confirmar que `main` local y `origin/main` están sincronizados.
