const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'react-native-google-places-autocomplete', 'GooglePlacesAutocomplete.js');

if (fs.existsSync(target)) {
  let content = fs.readFileSync(target, 'utf8');
  if (content.includes('const requestRef = useRef(_request);')) {
    content = content.replace('const requestRef = useRef(_request);', 'const requestRef = useRef();');
    fs.writeFileSync(target, content, 'utf8');
    console.log('✅ Patched react-native-google-places-autocomplete TDZ bug.');
  }
}
