import { createCLI } from "@bunli/core"
import { writeError } from "./helpers.js"
import { search } from "./commands/search.js"
import { detail } from "./commands/detail.js"
const cli=await createCLI({name:"jobkorea-cli",version:"0.1.0",description:"잡코리아 공개 채용공고 CLI"}); const commands=[search,detail];for(const c of commands)cli.command(c)
const argv=process.argv.slice(2);const invoked=commands.find(c=>(c as {name?:string}).name===argv[0]);if(invoked){const allowed=argv[0]==="search"?["--query","--page","--limit","--location","--career","--sort","--no-enrich","--enrich","--format","--help","--version","-q","-l","-h","-v"]:["--format","--help","--version","-h","-v"];for(const token of argv.slice(1)){const flag=token.split("=")[0];if((flag.startsWith("--")||/^-[^-]/.test(flag))&&!allowed.includes(flag)){writeError(`지원하지 않는 옵션: ${flag}`,"UNKNOWN_FLAG");process.exit(1)}}}await cli.run()
