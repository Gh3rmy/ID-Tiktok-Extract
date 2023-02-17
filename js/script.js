async function getTikTokUserId() {
        const username = document.getElementById('url').value;
        try {
          const response = await fetch(`https://cors-anywhere.herokuapp.com/https://www.tiktok.com/@${username}?lang=en`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
            }
          });
          const html = await response.text();
          const regex = /(?<=uniqueId":")(.*?)(?=")/;
          const match = html.match(regex);
          if (match) {
            const userId = match[0];
            document.getElementById('userId').textContent = userId;
          } else {
            throw new Error('Hubo un error al buscar el ID');
          }
        } catch (error) {
          console.error(error);
        }
      }
