FROM britesnow/base-agent:25-11-30

RUN mkdir /service

WORKDIR /service

COPY package.json ./
RUN npm install
COPY . .

ENTRYPOINT [ "/bin/bash", "-c", "source ~/.bashrc && /service/entrypoint.sh ${@}", "--" ]