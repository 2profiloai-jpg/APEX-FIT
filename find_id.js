import ytSearch from 'youtube-search-api';

async function find() {
  const result = await ytSearch.GetListByKeyword('curl bicipiti al cavo basso tutorial esecuzione italiano', false, 1);
  if (result && result.items && result.items.length > 0) {
    console.log("FOUND_ID:", result.items[0].id);
  }
}
find();
