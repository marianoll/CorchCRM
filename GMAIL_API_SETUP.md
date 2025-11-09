# Instrucciones para Configurar la API de Gmail

Para que la aplicación pueda acceder a tus correos de Gmail, necesitas crear credenciales de OAuth 2.0 en la Google Cloud Console y añadirlas a la aplicación.

Sigue estos pasos:

### 1. Habilitar la API de Gmail

1.  Ve a la [biblioteca de APIs de Google Cloud](https://console.cloud.google.com/apis/library).
2.  Asegúrate de que estás en el proyecto de Firebase correcto (`studio-381866080-1822f`).
3.  Busca "Gmail API" y haz clic en **Habilitar**.

### 2. Configurar la Pantalla de Consentimiento OAuth

Antes de crear las credenciales, debes configurar cómo se presentará tu aplicación a los usuarios cuando pidan permiso.

1.  Ve a la [página de la pantalla de consentimiento de OAuth](https://console.cloud.google.com/apis/credentials/consent).
2.  Selecciona **Externo** y haz clic en **Crear**.
3.  **Nombre de la aplicación**: Ponle un nombre, por ejemplo, "CorchCRM Dev".
4.  **Correo electrónico de asistencia del usuario**: Selecciona tu dirección de correo electrónico.
5.  **Datos de contacto del desarrollador**: Ingresa tu dirección de correo electrónico.
6.  Haz clic en **Guardar y continuar**.
7.  **Permisos (Scopes)**: Haz clic en **Añadir o quitar permisos**. Busca y añade los siguientes:
    *   `.../auth/gmail.readonly`
    *   `.../auth/userinfo.email`
    *   `.../auth/userinfo.profile`
    *   Haz clic en **Actualizar**.
8.  Haz clic en **Guardar y continuar**.
9.  **Usuarios de prueba**: Haz clic en **Añadir usuarios** e introduce tu propia dirección de correo electrónico de Gmail. Esto es crucial para poder probar la aplicación mientras está en modo de desarrollo.
10. Haz clic en **Guardar y continuar** y luego en **Volver al panel**.

### 3. Crear Credenciales de Cliente OAuth 2.0

Ahora crearás las claves que tu aplicación usará para identificarse ante Google.

1.  Ve a la [página de Credenciales](https://console.cloud.google.com/apis/credentials).
2.  Haz clic en **+ Crear credenciales** y selecciona **ID de cliente de OAuth**.
3.  **Tipo de aplicación**: Selecciona **Aplicación web**.
4.  **Nombre**: Ponle un nombre, como "CorchCRM Web Client".
5.  **URIs de redirección autorizados**: Esta es la parte más importante.
    *   Haz clic en **+ Añadir URI**.
    *   Introduce la siguiente URL: `http://localhost:9002/oauth/callback`
    *   *Nota: Si tu aplicación se ejecuta en un puerto diferente, cambia `9002` por el puerto correcto.*
6.  Haz clic en **Crear**.

### 4. Añadir las Credenciales a tu Aplicación

Después de crear las credenciales, aparecerá una ventana con tu **ID de cliente** y tu **Secreto de cliente**.

1.  Copia el **ID de cliente**.
2.  Abre el archivo `.env.local` en la raíz de tu proyecto.
3.  Pega el ID de cliente en la variable `GOOGLE_CLIENT_ID`.
4.  Vuelve a la ventana de Google Cloud y copia el **Secreto de cliente**.
5.  Pégalo en la variable `GOOGLE_CLIENT_SECRET` en tu archivo `.env.local`.

Tu archivo `.env.local` debería verse así (con tus valores reales):

```.env.local
GOOGLE_CLIENT_ID=TU_ID_DE_CLIENTE_AQUI.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=TU_SECRETO_DE_CLIENTE_AQUI
OAUTH_REDIRECT_URI=http://localhost:9002/oauth/callback
```

### 5. Reinicia la Aplicación

Después de guardar los cambios en `.env.local`, **debes reiniciar el servidor de desarrollo** para que las nuevas variables de entorno se carguen.

¡Y eso es todo! Ahora puedes volver a la página de "Settings" en la aplicación y usar el botón "Conectar con Gmail".
