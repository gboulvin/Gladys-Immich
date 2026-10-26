# Pase de fotos Immich para Gladys

## Objetivo

Esta integración externa de Gladys convierte uno o varios **álbumes de Immich** o la colección **Recuerdos — tal día como hoy** en una cámara virtual. Añada esa cámara al dashboard de Gladys para mostrar un pase de fotos que cambia automáticamente. Las fotos se quedan en el servidor Immich configurado: la integración solo pide las vistas previas de Immich y nunca descarga los originales.

La integración requiere Gladys **5.3.0 o posterior**. Cada pase de fotos es una cámara virtual, utilizable en un bloque de cámara del dashboard. La integración añade también un **widget de dashboard «Foto de Immich»** y una **acción de escena** que muestra la foto siguiente. Está disponible en inglés, francés, alemán y español.

## Requisitos previos

Necesita un servidor Immich accesible y una clave API creada en **Immich → Ajustes de la cuenta → Claves API**. Conceda a la clave solo los permisos siguientes:

| Permiso       | Para qué sirve                                          |
| ------------- | ------------------------------------------------------- |
| `album.read`  | Lista los álbumes y lee el álbum elegido.               |
| `asset.read`  | Busca los medios del álbum seleccionado.                |
| `asset.view`  | Descarga una vista previa para la cámara del dashboard. |
| `memory.read` | Lee el origen opcional de recuerdos «tal día como hoy». |

El contenedor de Gladys debe poder acceder a la URL introducida en el formulario de configuración. Para un servidor de su red local, use su dirección LAN y el puerto de Immich, por ejemplo `http://192.168.1.20:2283`. No use `localhost`: designa el contenedor aislado de la integración, no el host de Gladys ni el servidor Immich.

## Configuración

Abra **Integraciones → Immich Slideshow → Configuración** e introduzca la URL del servidor y la clave API del **Pase 1**. Elija **Álbum** o **Recuerdos — tal día como hoy**. Para uno o varios álbumes, pulse **Listar los álbumes de Immich** tras introducir la URL del servidor y la clave API. La acción devuelve el nombre, el UUID y el número de medios de cada álbum; introduzca uno o varios UUID en **UUID de los álbumes**, separados por comas o saltos de línea. La integración fusiona los álbumes, elimina las fotos duplicadas y aplica el límite de imágenes al origen completo. El botón **Probar la conexión con Immich** confirma que Gladys puede listar los álbumes con la clave configurada.

Elija el intervalo entre fotos, la frecuencia de actualización de la lista del origen y el número máximo de imágenes que conservar. Active **Mostrar la leyenda de Immich** para añadir la descripción, el lugar y la fecha de la foto de Immich, si existen, en una franja legible en la parte inferior de cada imagen. **Idioma de la leyenda** fija el idioma de la fecha de esa franja (inglés, francés, alemán o español) y del nombre del origen que devuelve la acción de escena; el widget del dashboard usa siempre el idioma de cada usuario. La actualización del origen es independiente a propósito del intervalo entre fotos: un álbum grande solo se consulta periódicamente y cada vista previa solo se descarga cuando se muestra. Los vídeos se excluyen. Por defecto, las imágenes más recientes aparecen primero; active el orden aleatorio para mezclar cada lista recargada.

Guarde la configuración, abra la pestaña **Descubrimiento** de la integración y cree la cámara **Immich slideshow**. También puede crear **Immich slideshow 2**: su perfil es totalmente independiente y puede usar otro álbum, los recuerdos, otros intervalos, otro ajuste de leyenda o incluso otro servidor Immich. Rellene los campos del **Pase 2** antes de crear esta segunda cámara y use después sus propios botones de prueba de conexión, lista de álbumes y actualización. Añada cada cámara a un bloque de cámara en el dashboard de Gladys que prefiera, de modo que la primera cámara pueda estar en un dashboard y la segunda en otro. La primera imagen de cada cámara se publica de inmediato y luego cada cámara se actualiza según su propio intervalo.

## Estado de conexión e insignia de transporte

La pestaña **Configuración** muestra un estado de conexión para la integración: se pone en rojo en cuanto falla un pase configurado, con el motivo (servidor inaccesible, clave rechazada, origen vacío…), y vuelve a verde por sí solo cuando el pase funciona de nuevo. Un clic correcto en **Probar** o **Actualizar** también borra un error antiguo.

Cada cámara lleva además una insignia de transporte. Indica **local** cuando la URL de Immich apunta a su red doméstica (una dirección privada como `192.168.x.x`, un nombre en `.local`, `.lan` o `.home.arpa`, un nombre corto de contenedor, una dirección Tailscale), **cloud** cuando pasa por Internet (nombre de dominio público, proxy inverso, túnel) y **unreachable** cuando Immich no responde. Un punto naranja significa que Immich responde pero el pase no puede funcionar: pase el ratón por la insignia para leer el motivo. Como cada pase tiene una sola URL de Immich, el interruptor **Preferir la conexión local** de la pantalla de configuración no tiene efecto: para conectarse en local, introduzca la dirección de red local de su servidor.

## Privacidad y tratamiento de las imágenes

La clave API se declara como `secret` de Gladys: se guarda de forma segura y nunca se devuelve al navegador del dashboard. Las peticiones a Immich incluyen la cabecera `x-api-key` dentro del contenedor de la integración. Las vistas previas se orientan correctamente, se redimensionan y se comprimen en JPEG antes de enviarse por el canal de cámara de Gladys; así el dashboard sigue fluido y se respeta el límite de tamaño del canal. Si está activada, la información de Immich seleccionada se incrusta en una franja de alto contraste en la parte inferior de la vista previa y viaja, por tanto, con la imagen de la cámara hasta el dashboard.

## Solución de problemas

Si la prueba de conexión indica una clave o unos permisos no válidos, cree una nueva clave API de Immich con los cuatro permisos indicados arriba. Si un álbum aparece vacío aunque contiene fotos, actualice a esta versión: las versiones recientes de Immich exponen los metadatos del álbum por separado de sus medios, que la integración obtiene ahora mediante la búsqueda de metadatos filtrada por álbum. Si el servidor es inaccesible, compruebe la URL desde la red del host de Gladys y asegúrese de que ni un proxy inverso, ni un cortafuegos, ni una red Docker impiden al contenedor de la integración externa acceder a Immich. Un álbum vacío o una colección de recuerdos vacía es un estado normal; añada fotos o elija otro origen. El registro de la integración, en la pestaña Configuración de Gladys, contiene la categoría del fallo a nivel HTTP sin revelar su clave API.

## Widget «Foto de Immich»

Al editar el dashboard, añada el widget **Foto de Immich** y elija en sus ajustes la cámara de pase que seguir (la cámara debe haberse creado en la pestaña **Descubrimiento**). El widget muestra la foto actual, su leyenda cuando la leyenda incrustada está desactivada, el estado del pase, cómo se accede al servidor Immich (local o nube), el origen y el número de fotos. El botón **Foto siguiente** hace avanzar la cámara de inmediato; **Actualizar** vuelve a leer el álbum o los recuerdos del día. El widget sigue a la cámara: se actualiza con cada foto nueva. Si algo falla, muestra el motivo en lugar de la foto.

## Acción de escena «Mostrar la siguiente foto de Immich»

En una escena, la acción **Mostrar la siguiente foto de Immich** hace avanzar la cámara elegida y, si se desea, vuelve a leer antes el origen. Produce tres variables para las acciones siguientes: **Foto mostrada** (verdadero o falso), **Nombre del archivo de la foto** y **Álbum o recuerdos**. Un pase sin configurar o con fallos no hace fallar la escena: **Foto mostrada** vale entonces falso, para que el resto de la escena pueda depender de ello.

Ejemplo: cada mañana a las 8, mostrar la siguiente foto de los recuerdos del día y, si **Foto mostrada** es verdadero, enviarla en un mensaje con la acción integrada **Enviar la imagen de la cámara**.

## Referencias

[1] [Endpoints de la API de Immich](https://api.immich.app/endpoints)
[2] [Integraciones externas de Gladys](https://gladysassistant.com/docs/dev/external-integrations/)
