function Wordmark({ className = 'wordmark', ...props }) {
  return <a className={className} href="#top" {...props}><span className="wordmark-mark">t.</span> threadline</a>
}

export default Wordmark
