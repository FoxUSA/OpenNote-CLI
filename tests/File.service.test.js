let upgradeHTMLTest = ()=>{//FIXME remove next version. Pretains to file Service which is a temporary upgrade assistance tool
    let s3Credentials = {
        s3URL:"http://127.0.0.1:9000",
        bucket:"opennote",
        accessKey:"test",
        secretKey:"test"
    };

    let s3= new AWS.S3({
        accessKeyId: s3Credentials.accessKey ,
        secretAccessKey: s3Credentials.secretKey,
        endpoint: s3Credentials.s3URL,
        signatureVersion: "v2"//required for really long tokens
    });

    let updateHTML = updateHTMLFactory({}, s3, s3Credentials);

    let testData = `
        <img src="https://hostname/OpenNote/Service/service.php/file/11123127" /><a href="//hostname.com/OpenNote/Service/service.php/file/fsdfasd58-EA50-BE1B-fsd-528GFFD51-ERCA6E74">Here is the backup Netgear configuration</a>gdafgadfjghakdfjgkadfj<img alt="" src="//hostname.com/OpenNote/Service/service.php/file/2D8C4AC5-6895-07BE-966C-46C746A94A5F" style="height:300px; width:602px" />
        <a href="https:/hostname/OpenNote/Service/file/112312319">sdfasdfasd.pdf</a>
        <img src="https://hostname.com/OpenNote/Service/file/62541351351" style="height:329px; width:634px" />
        <img alt="iPhone Screenshot 2" src="https://hostname.com/OpenNote/Service/upload/safgsadgasdgdsfg.jpg" style="height:384px; width:216px" /></p>
        <p><img src="./upload/363546735.png" style="height:438px; width:544px" /></p>
        <a href="./upload/1381159dsafasdgf722_Exam 1.pdf">Exam 1.pdf</a>`;

    updateHTML(testData).then((note)=>{
        console.log(note);
    });
};
