import fs from 'fs';
import ytSearch from 'youtube-search-api';

async function updateVideos() {
  const filePath = 'src/components/ExerciseLibrary.tsx';
  let content = fs.readFileSync(filePath, 'utf8');

  // Match the array items roughly, or we can just regex replace line by line
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/name: '([^']+)'/);
    if (match && line.includes('videoUrl')) {
      const exName = match[1];
      console.log(`Searching for: ${exName}`);
      try {
        const result = await ytSearch.GetListByKeyword(`${exName} esecuzione tutorial ita palestra`, false, 1);
        if (result && result.items && result.items.length > 0) {
          const videoId = result.items[0].id;
          console.log(`Found ID: ${videoId} for ${exName}`);
          // Replace the fake video ID
          lines[i] = line.replace(/videoUrl: 'https:\/\/www\.youtube\.com\/embed\/[a-zA-Z0-9_-]+'/, `videoUrl: 'https://www.youtube.com/embed/${videoId}'`);
        } else {
             const resultEng = await ytSearch.GetListByKeyword(`${exName} form tutorial`, false, 1);
             if (resultEng && resultEng.items && resultEng.items.length > 0) {
                 const videoId = resultEng.items[0].id;
                 lines[i] = line.replace(/videoUrl: 'https:\/\/www\.youtube\.com\/embed\/[a-zA-Z0-9_-]+'/, `videoUrl: 'https://www.youtube.com/embed/${videoId}'`);
             }
        }
      } catch (err) {
        console.error(`Error searching for ${exName}`, err);
      }
    }
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log('Update complete!');
}

updateVideos();
