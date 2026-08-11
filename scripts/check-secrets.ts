import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const tracked=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const patterns=[
  {name:'OpenAI key',regex:/\bsk-[A-Za-z0-9_-]{20,}\b/g},
  {name:'GitHub token',regex:/\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g},
  {name:'Google API key',regex:/\bAIza[0-9A-Za-z_-]{30,}\b/g},
  {name:'Private key',regex:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g},
  {name:'Provider secret assignment',regex:/\b(?:ADMIN_API_TOKEN|API_FOOTBALL_KEY|KICKOFF_API_KEY|FOOTBALL_DATA_API_KEY)[ \t]*=[ \t]*["']?([^\s"']{16,})/g},
];
const findings:string[]=[];
for(const file of tracked){
  if(!fs.existsSync(file)||fs.statSync(file).size>2_000_000)continue;
  const content=fs.readFileSync(file,'utf8');
  for(const pattern of patterns){
    pattern.regex.lastIndex=0;
    for(const match of content.matchAll(pattern.regex)){
      const value=String(match[1]??match[0]);
      if(/change-me|incolla|your[_-]|example|placeholder|\$\{|<[^>]+>/i.test(value))continue;
      findings.push(`${file}: ${pattern.name}`);break;
    }
  }
}
if(findings.length){console.error(`Possibili segreti rilevati:\n${findings.join('\n')}`);process.exitCode=1;}else console.log(`Secret scan: ${tracked.length} file tracciati controllati, nessun segreto rilevato.`);
