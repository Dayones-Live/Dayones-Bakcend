export const extractS3KeyFromUrl = (url: string): string => {
  // Split the URL by the bucket URL and take the last part as the key
  const s3BucketUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/`;
  if (url.startsWith(s3BucketUrl)) {
    return url.split(s3BucketUrl)[1];
  }
  throw new Error('Invalid S3 URL');
};
