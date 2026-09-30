const validNotes = [];
for(let i=0; i<100; i++) {
  validNotes.push({ fileName: `note_${i}.md`, title: `Note ${i}`, content: `Content ${i}` });
}
console.log(validNotes.length);
