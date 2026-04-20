import fs from 'fs';
import ytSearch from 'youtube-search-api';

async function updateVideos() {
  const filePath = 'src/components/ExerciseLibrary.tsx';
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  
  // We only care about lines with 'name:' and 'videoUrl:'
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/name: '([^']+)'/);
    if (match && line.includes('videoUrl')) {
      const exName = match[1];
      console.log(`Searching for: ${exName}`);
      let videoId = null;
      
      try {
        let result = await ytSearch.GetListByKeyword(`${exName} tutorial italiano palestrare project invictus umberto miletto`, false, 2);
        let item = result?.items?.find(v => v.type === 'video');
        if (item) videoId = item.id;
        
        if (!videoId) {
           result = await ytSearch.GetListByKeyword(`${exName} tutorial esecuzione corretta italiano`, false, 2);
           item = result?.items?.find(v => v.type === 'video');
           if (item) videoId = item.id;
        }

        if (videoId) {
          console.log(`✅ Found ID: ${videoId} for ${exName}`);
          lines[i] = line.replace(/videoUrl: 'https:\/\/www\.youtube\.com\/embed\/[a-zA-Z0-9_-]+'/, `videoUrl: 'https://www.youtube.com/embed/${videoId}'`);
          // Save incrementally to prevent total loss if timeout
          fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        } else {
          console.log(`❌ No video found for ${exName}`);
        }
      } catch (err) {
        console.error(`Error searching for ${exName}`, err.message);
      }
      
      // tiny delay
      await new Promise(r => setTimeout(r, 100));
    }
  }

  console.log('Update complete!');
}

updateVideos();
