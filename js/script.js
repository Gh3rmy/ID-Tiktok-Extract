async function getTikTokUserId() {
  const username = document.getElementById('url').value;
  try {
      // Cambia el proxy si es necesario
      const response = await fetch(`https://cors-proxy.htmldriven.com/?url=https://www.tiktok.com/@${username}?lang=en`, {
          method: 'GET',
          headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
          }
      });

      // Verifica si la respuesta fue exitosa
      if (!response.ok) {
          throw new Error('Network response was not ok');
      }

      const html = await response.text();
      const regex = /(?<=uniqueId":")(.*?)(?=")/; // Asegúrate de que este patrón sea correcto
      const match = html.match(regex);

      if (match) {
          const userId = match[0];
          document.getElementById('userId').textContent = userId;
      } else {
          throw new Error('Hubo un error al buscar el ID');
      }
  } catch (error) {
      console.error(error);
      alert(error.message); // Muestra un mensaje al usuario en caso de error
  }
}
