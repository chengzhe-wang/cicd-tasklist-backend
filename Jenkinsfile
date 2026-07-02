pipeline {
  agent any

  environment {
    IMAGE_NAME = 'tasklist-backend'
    SONAR_PROJECT_KEY = 'Chengzhe_Tasklist_Back'
    SONAR_HOST_URL = 'https://sonarqube.cicd.kits.ext.educentre.fr'
    TRIVY_IMAGE = 'aquasec/trivy:0.56.2'
    TRIVY_SEVERITY = 'HIGH,CRITICAL'
  }

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install Dependencies') {
      steps {
        sh 'npm ci'
      }
    }

    stage('Generate Prisma Client') {
      steps {
        sh 'npm run prisma:generate'
      }
    }

    stage('Build') {
      steps {
        sh 'npm run build'
      }
    }

    stage('Unit Tests + Coverage') {
      steps {
        sh 'npm run test:coverage'
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'reports/junit.xml'
        }
      }
    }

    stage('SonarQube Analysis') {
      steps {
        withCredentials([string(credentialsId: 'sonarqube-token', variable: 'SONAR_TOKEN')]) {
          sh '''
            sonar-scanner \
              -Dsonar.host.url=$SONAR_HOST_URL \
              -Dsonar.projectKey=$SONAR_PROJECT_KEY \
              -Dsonar.sources=src \
              -Dsonar.exclusions=src/server.ts,src/routes/**,src/lib/**,src/__tests__/**/*.test.ts \
              -Dsonar.tests=src/__tests__ \
              -Dsonar.test.inclusions=src/__tests__/**/*.test.ts \
              -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
              -Dsonar.qualitygate.wait=true \
              -Dsonar.qualitygate.timeout=300 \
              -Dsonar.token=$SONAR_TOKEN
          '''
        }
      }
    }

    stage('Build Docker Image') {
      steps {
        sh '''
          docker build \
            -t ${IMAGE_NAME}:${BUILD_NUMBER} \
            -t ${IMAGE_NAME}:latest \
            .
        '''
      }
    }

    stage('Trivy Scan (Block HIGH/CRITICAL)') {
      steps {
        sh '''
          mkdir -p reports

          docker run --rm \
            -v /var/run/docker.sock:/var/run/docker.sock \
            "$TRIVY_IMAGE" image --no-progress \
            --format json \
            "$IMAGE_NAME:$BUILD_NUMBER" > reports/trivy-image-report.json

          docker run --rm \
            -v /var/run/docker.sock:/var/run/docker.sock \
            "$TRIVY_IMAGE" image --no-progress \
            --format spdx-json \
            "$IMAGE_NAME:$BUILD_NUMBER" > reports/sbom-image-spdx.json

          docker run --rm \
            -v /var/run/docker.sock:/var/run/docker.sock \
            "$TRIVY_IMAGE" image --no-progress \
            --severity "$TRIVY_SEVERITY" \
            --exit-code 1 \
            "$IMAGE_NAME:$BUILD_NUMBER"
        '''
      }
    }

    stage('Push Docker Image') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
          script {
            env.DOCKER_IMAGE = "${DOCKERHUB_USER}/${IMAGE_NAME}"
          }
          sh 'echo "$DOCKERHUB_PASS" | docker login -u "$DOCKERHUB_USER" --password-stdin'
          sh 'docker tag ${IMAGE_NAME}:${BUILD_NUMBER} ${DOCKER_IMAGE}:${BUILD_NUMBER}'
          sh 'docker tag ${IMAGE_NAME}:latest ${DOCKER_IMAGE}:latest'
          sh 'docker push ${DOCKER_IMAGE}:${BUILD_NUMBER}'
          sh 'docker push ${DOCKER_IMAGE}:latest'
        }
      }
    }
  }

  post {
    always {
      script {
        archiveArtifacts allowEmptyArchive: true, artifacts: 'reports/junit.xml,reports/trivy-image-report.json,reports/sbom-image-spdx.json,coverage/**'
        try {
          sh 'docker logout || true'
        } catch (Exception e) {
          echo "docker logout ignoré: ${e.getClass().getSimpleName()}"
        }
        try {
          cleanWs()
        } catch (Exception e) {
          echo "cleanWs ignoré: ${e.getClass().getSimpleName()}"
        }
      }
    }
    success {
      echo "Pipeline backend terminé avec succès - image poussée : ${env.DOCKER_IMAGE}:${BUILD_NUMBER}"
    }
    failure {
      echo 'Pipeline backend en échec - voir les logs ci-dessus.'
    }
  }
}
