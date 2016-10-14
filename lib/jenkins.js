const fetch = require('node-fetch');
const prettyjson = require('prettyjson');

class JenkinsJob {
  constructor(jobName="Performance Tests", projectName="Genresmanagement", url) {
    this.jobName = jobName;
    
    this.projectName = ((projectName) => {
      const jobName = process.argv.find((arg) => arg.includes('job'));
      if(jobName) {
        return jobName.split(':').pop();
      }
      return projectName;
    })(projectName);
    
    this.shouldMarkForever = (() => {
      const mark = process.argv.find((arg) => arg.includes('mark-forever'));
      if(mark) {
        const willMark = mark.split(':').pop() === "true" ? true : false;
        console.log(`willMark ${willMark}`);
        return  willMark;
      }
      return false;
    })();
    
    this.url = (() => {
      const url = process.argv.find((arg) => arg.includes('url'));
      if(url) {
        return url.substring(4);
      }
      throw new Error('url option is required (base environment url)');
    })();
    this.projectUrl = `${this.url}${this.jobName}/job/${this.projectName}/`;
    
    console.log(`Fetching from ${this.projectUrl}`);
    
    this.request = fetch(`${this.projectUrl}/api/json\?pretty\=true`).then((request) => request.json()).catch(console.warn);
  }

  async getJobs() {
    const { jobs } = await this.request;
    console.log(`got ${jobs.length} jobs`);
    return jobs.map(({ name, url }) => ({ name, url }));
  }
  
  async getLastSuccessfulBuild(jobName) {
    return this.getLastNSuccessfulBuilds(jobName, 1);
  }

  async getLastNSuccessfulBuilds(jobName, n=3) {
    const job = await fetch(`${this.projectUrl}/job/${jobName}/api/json\?pretty\=true`)
          .then((request) => request.json())
          .catch(console.log);
    const builds = job.builds.sort(({ number: a }, { number: b}) => a < b);

    const promises = builds.map(async (build) => {
      const data = await fetch(`${build.url}api/json`).then((request) => request.json());
      if(data.result === "SUCCESS") {
        return data;
      }
    });
    
    return await Promise.all(promises).then((successfulBuilds) => {
      return successfulBuilds.filter((build) => !!build).slice(0, n);
    });
  }

  async getBuildDuration(jobUrl) {
    const apiUrl = `${jobUrl}api/json\?pretty\=true`;
    return fetch(apiUrl).then((request) => request.json()).then(({ duration }) => duration).catch(console.warn);
  }

  async getAllDurationForAllJobs() {
    const jobs = await this.getJobs();

    return Promise.all(jobs.map(async ({ name }) => {
      const lastBuilds = await this.getLastNSuccessfulBuilds(name);
      
      console.log('\x1b[37m', `${name} fetched ${lastBuilds.length} successful builds`);
      
      if (lastBuilds.length < 3) {
        console.error('\x1b[31m', `${name} build has less than 3 (${lastBuilds.length}) successful builds`);
      }

      const data = await Promise.all(lastBuilds.map(async ({ url, number }) => {
        const duration = await this.getBuildDuration(url);
        return {
          number,
          duration: duration / 1000
        }
      })).catch(console.warn);

      return {
        name,
        data
      }
    })).catch(console.warn);
  }

  async markBuildsForever(builds) {
    return Promise.all(builds.map(async (build) => {
      const prom = build.reduce((prev, curr) => {
        prev.push(fetch(`${curr}toggleLogKeep`));
        return prev;
      }, []);
      return prom;
    }));
  }

  async getLastSuccessfulBuildsAndKeepThemForever() {
    const jobs = await this.getJobs();

    const lastSuccessfulBuilds = await Promise.all(jobs.map(async ({ name }) => {
      const builds = await this.getLastNSuccessfulBuilds(name);
      // console.log(`${number} - ${url}`);
      return builds.reduce((prev, { url }) => {
        prev.push(url);
        return prev;
      }, []);
    })).catch(console.warn);
    return await this.markBuildsForever(lastSuccessfulBuilds)
      .then(({ length }) => console.log(`Saved ${length} builds`))
      .catch(console.warn);
  }
}

(async () => {
  const jenkins = new JenkinsJob();
  const durations = await jenkins.getAllDurationForAllJobs();
  console.log(prettyjson.render(durations));
  if(jenkins.shouldMarkForever) {
    await jenkins.getLastSuccessfulBuildsAndKeepThemForever();
    console.log()
  }
})();
