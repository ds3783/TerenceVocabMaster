import {default as OSS} from 'ali-oss'
import NestiaWeb from "nestia-web";


export async function uploadFile(localFilePath, remoteFilePath) {
    const accessKeyId = NestiaWeb.manifest.get('aliyun.accessKeyId');
    const accessKeySecret = NestiaWeb.manifest.get('aliyun.accessKeySecret');
    const bucketName = NestiaWeb.manifest.get('aliyun.bucketName');
    const region = NestiaWeb.manifest.get('aliyun.bucketRegion');
    const client = new OSS({
        region: region,
        accessKeyId: accessKeyId,
        accessKeySecret: accessKeySecret,
        bucket: bucketName,
    });
    try {
        const result = await client.put(remoteFilePath, localFilePath);
        NestiaWeb.logger.info('File uploaded successfully:', result);
        // 获取文件的URL
        const downloadUrl = `https://${bucketName}.${region}.aliyuncs.com${remoteFilePath}`;
        NestiaWeb.logger.info('Download URL:', downloadUrl);
        return downloadUrl;
    } catch (error) {
        NestiaWeb.logger.error('Failed to upload file:', error);
        throw error;
    }
}
    