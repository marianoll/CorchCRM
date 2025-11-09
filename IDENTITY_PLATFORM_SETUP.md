# Instrucciones para Habilitar la API Identity Platform

Para que Firebase Authentication funcione correctamente, es necesario que la API "Google Identity Platform" esté habilitada en tu proyecto de Google Cloud. Este error suele ocurrir si se ha deshabilitado manualmente o nunca se habilitó después de configurar Firebase.

Sigue estos sencillos pasos para solucionarlo:

### 1. Ve a la Biblioteca de APIs de Google Cloud

1.  Haz clic en el siguiente enlace para ir directamente a la página de la API Identity Platform en la biblioteca de APIs:
    [https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com](https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com)

2.  Asegúrate de que estás en el proyecto de Firebase correcto. El nombre del proyecto debería ser **`studio-381866080-1822f`**. Puedes verificarlo y seleccionarlo en la parte superior de la página de Google Cloud Console.

### 2. Habilita la API

1.  En la página de la API "Identity Platform", verás un botón que dice **Habilitar** (o "Enable").
2.  Haz clic en ese botón.

Espera unos segundos a que Google Cloud termine de habilitar la API.

### 3. ¡Listo!

Una vez que la API esté habilitada, no necesitas hacer nada más. Vuelve a la aplicación y actualiza la página. El error de autenticación debería haber desaparecido.

¡Eso es todo! Con esto, el servicio de autenticación de Firebase tendrá los permisos necesarios para funcionar.
