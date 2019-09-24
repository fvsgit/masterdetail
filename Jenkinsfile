node('sapui5') {

    stage('Checkout Jenkinsfile') {

        cleanWs()
        
        //Checkout general CI repo with Jenkinsfile
        checkout([$class: 'GitSCM', branches: [[name: 'master']], doGenerateSubmoduleConfigurations: false, extensions: [], gitTool: 'Default', submoduleCfg: [], userRemoteConfigs: [[credentialsId: 'sapcigithubtoken', url: 'https://github.deutsche-boerse.de/dev/sap.crm-ci_configuration']]])
         
        if (JOB_NAME.contains("release")){
            
            //Since the job that is currently running is a release job, we have to check for which branch it is running.
            
            echo env.BRANCH_NAME
            
            //Load the jenkins file that will build the MTAR file, deploy it to SCP and archive it in Artifactory
            load "PipelineFiles/JenkinsCons.groovy"
        }else{
            //Load the jenkins file that will perform the build and quality checks
            load "PipelineFiles/JenkinsBuild.groovy"
        }
    }
}
