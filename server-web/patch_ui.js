const fs = require('fs');
let p = '/Users/wikies/www/dev-chat/app-web/src/pages/Project/ProjectDetailPage.tsx';
let txt = fs.readFileSync(p, 'utf-8');
const searchBlock = \`<div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs uppercase tracking-wider text-gray-500">
                            项目目标
                          </h3>\`;

txt = txt.replace(searchBlock, 'DEL_MARKER_GOAL');
const contentBlock = \`<div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs uppercase tracking-wider text-gray-500">
                            项目内容
                          </h3>\`;
txt = txt.replace(contentBlock, 'DEL_MARKER_CONTENT');
fs.writeFileSync(p, txt);
